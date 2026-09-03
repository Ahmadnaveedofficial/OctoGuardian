import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { TokenService } from './token/token.service';
import { OtpService } from './otp/otp.service';
import { MailService } from '../mail/mail.service';
import { Session, SessionDocument } from './schemas/session.schema';
import { Blacklist, BlacklistDocument } from './schemas/blacklist.schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import {
  RegisterDto,
  LoginDto,
  VerifyDto,
  ResendOptDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RequestReactivationDto,
  ReactivateAccountDto,
} from './dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Blacklist.name)
    private readonly blacklistModel: Model<BlacklistDocument>,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already registered');

    const hashedPassword = await this.passwordService.hash(dto.password);
    const { otp, expiresAt } = this.otpService.generateOtp();

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
      otp,
      otpExpiry: expiresAt,
      isVerified: false,
    });

    await this.mailService.sendOtpEmail(
      user.email,
      otp,
      'Account Verification OTP',
    );
    return { message: 'Registration initiated. Please verify your OTP.' };
  }

  async verifyOtp(dto: VerifyDto, userAgent: string, ipAddress: string) {
    const user = await this.usersService.findByEmailWithOtp(dto.email);
    if (!user || !user.otp || !user.otpExpiry)
      throw new BadRequestException('No OTP found');

    this.otpService.validateOtp(user.otp, user.otpExpiry, dto.otp);

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const tokens = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
    );

    // Save Multi-Device Session
    const hash = await this.passwordService.hash(tokens.refreshToken);
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: hash,
      userAgent,
      ipAddress,
      expiresAt: sessionExpiry,
    });

    return {
      message: 'Account verified successfully',
      user: this.usersService.toUserResponse(user),
      tokens,
    };
  }

  async login(dto: LoginDto, userAgent: string, ipAddress: string) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) {
      throw new ForbiddenException(
        'Account deactivated. Request reactivation.',
      );
    }

    const isMatch = await this.passwordService.compare(
      dto.password,
      user.password,
    );
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
    );

    // Create New Independent Session for this specific device
    const hash = await this.passwordService.hash(tokens.refreshToken);
    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: hash,
      userAgent,
      ipAddress,
      expiresAt: sessionExpiry,
    });

    return {
      user: this.usersService.toUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(
    rawRefreshToken: string,
    userAgent: string,
    ipAddress: string,
  ) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    // Find all active sessions for this user
    const sessions = await this.sessionModel.find({
      userId: new Types.ObjectId(payload.sub),
    });

    let matchedSession: SessionDocument | null = null;
    for (const session of sessions) {
      const isMatch = await this.passwordService.compare(
        rawRefreshToken,
        session.refreshTokenHash,
      );
      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    // Reuse Detection: Token is valid JWT but does not exist in active sessions
    if (!matchedSession) {
      // Invalidate ALL sessions of this user (Potential Compromise)
      await this.sessionModel.deleteMany({
        userId: new Types.ObjectId(payload.sub),
      });
      throw new ForbiddenException(
        'Token reuse detected. All sessions revoked.',
      );
    }

    // Issue New Tokens
    const tokens = await this.tokenService.generateTokenPair(
      payload.sub,
      payload.email,
    );

    // Rotate this specific device session
    const newHash = await this.passwordService.hash(tokens.refreshToken);
    matchedSession.refreshTokenHash = newHash;
    matchedSession.userAgent = userAgent;
    matchedSession.ipAddress = ipAddress;
    matchedSession.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await matchedSession.save();

    return tokens;
  }

  async logout(
    userId: string,
    rawRefreshToken: string | undefined,
    accessPayload: (JwtPayload & { jti?: string; exp?: number }) | undefined,
  ): Promise<void> {
    // 1. Delete this device session from MongoDB
    if (rawRefreshToken) {
      const sessions = await this.sessionModel.find({
        userId: new Types.ObjectId(userId),
      });
      for (const session of sessions) {
        const isMatch = await this.passwordService.compare(
          rawRefreshToken,
          session.refreshTokenHash,
        );
        if (isMatch) {
          await this.sessionModel.findByIdAndDelete(session._id);
          break;
        }
      }
    }

    // 2. Blacklist current Access Token till its TTL
    if (accessPayload?.jti && accessPayload?.exp) {
      await this.blacklistModel.create({
        tokenId: accessPayload.jti,
        expiresAt: new Date(accessPayload.exp * 1000),
      });
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.sessionModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await this.passwordService.compare(
      dto.oldPassword,
      user.password,
    );
    if (!isMatch) throw new UnauthorizedException('Incorrect old password');

    const hashedPassword = await this.passwordService.hash(dto.newPassword);
    user.password = hashedPassword;
    await user.save();

    // Invalidate all active device sessions on password change
    await this.logoutAllDevices(userId);

    return {
      message: 'Password updated successfully. All devices logged out.',
    };
  }

  async resendOtp(dto: ResendOptDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('User not found');

    const { otp, expiresAt } = this.otpService.generateOtp();
    await this.usersService.updateByEmail(dto.email, {
      otp,
      otpExpiry: expiresAt,
    });
    await this.mailService.sendOtpEmail(dto.email, otp, 'Resent OTP');
    return { message: 'Fresh OTP has been dispatched' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Account does not exist');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersService.updateByEmail(dto.email, {
      resetPasswordToken: resetToken,
      resetPasswordExpiry: resetExpiry,
    });
    await this.mailService.sendPasswordResetEmail(dto.email, resetToken);
    return { message: 'Reset token dispatched to your email' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmailWithResetToken(dto.email);
    if (!user || !user.resetPasswordToken || !user.resetPasswordExpiry) {
      throw new BadRequestException('Invalid reset request');
    }

    if (
      new Date() > user.resetPasswordExpiry ||
      user.resetPasswordToken !== dto.token
    ) {
      throw new BadRequestException('Reset token expired or invalid');
    }

    const hashedPassword = await this.passwordService.hash(dto.newPassword);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    // Revoke all sessions on reset
    await this.logoutAllDevices(user._id.toString());

    return { message: 'Password reset successfully' };
  }

  async requestReactivation(dto: RequestReactivationDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) throw new NotFoundException('Account not found');
    if (user.isActive)
      throw new BadRequestException('Account is already active');

    const isMatch = await this.passwordService.compare(
      dto.password,
      user.password,
    );
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const { otp, expiresAt } = this.otpService.generateOtp();
    await this.usersService.updateByEmail(dto.email, {
      otp,
      otpExpiry: expiresAt,
    });
    await this.mailService.sendOtpEmail(
      dto.email,
      otp,
      'Reactivation OTP Code',
    );
    return { message: 'Reactivation OTP dispatched' };
  }

  async reactivateAccount(dto: ReactivateAccountDto) {
    const user = await this.usersService.findByEmailWithOtp(dto.email);
    if (!user || !user.otp || !user.otpExpiry)
      throw new BadRequestException('No request found');

    this.otpService.validateOtp(user.otp, user.otpExpiry, dto.otp);
    user.isActive = true;
    user.deactivatedAt = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return { message: 'Account reactivated successfully' };
  }

  async getUserSessions(userId: string) {
    const sessions = await this.sessionModel.find({
      userId: new Types.ObjectId(userId),
    });
    return {
      sessions: sessions.map((s) => ({
        _id: s._id.toString(),
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        expiresAt: s.expiresAt,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionModel.findByIdAndDelete(sessionId);
    return { message: 'Session revoked successfully' };
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { TokenService } from './token/token.service';
import { OtpService } from './otp/otp.service';
import { MailService } from '../mail/mail.service';
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

  async verifyOtp(dto: VerifyDto) {
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
    const hash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.updateById(user._id.toString(), {
      refreshTokenHash: hash,
    });

    return {
      message: 'Account verified successfully',
      user: this.usersService.toUserResponse(user),
      tokens,
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

  async login(dto: LoginDto) {
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
    const hash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.updateById(user._id.toString(), {
      refreshTokenHash: hash,
    });

    return {
      user: this.usersService.toUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(rawRefreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.refreshTokenHash)
      throw new ForbiddenException('Session revoked');

    const isMatch = await this.passwordService.compare(
      rawRefreshToken,
      user.refreshTokenHash,
    );
    if (!isMatch) {
      await this.usersService.updateById(user._id.toString(), {
        refreshTokenHash: null,
      });
      throw new ForbiddenException('Token reuse detected');
    }

    const tokens = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
    );
    const newHash = await this.passwordService.hash(tokens.refreshToken);
    await this.usersService.updateById(user._id.toString(), {
      refreshTokenHash: newHash,
    });

    return tokens;
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
    user.refreshTokenHash = undefined;
    await user.save();

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
    user.refreshTokenHash = undefined;
    await user.save();

    return { message: 'Password updated successfully' };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateById(userId, { refreshTokenHash: null });
  }
}

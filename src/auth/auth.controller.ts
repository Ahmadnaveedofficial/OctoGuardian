import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  Headers,
  Delete,
  Param,
  Ip,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  VerifyDto,
  ResendOptDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RequestReactivationDto,
  ReactivateAccountDto
} from './dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { setAuthCookies, clearAuthCookies } from '../common/utils/cookie.util';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Auth Endpoints')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user and dispatch OTP' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and issue cookies' })
  async verifyOtp(
    @Body() dto: VerifyDto,
    @Headers('user-agent') userAgent = 'Unknown Device',
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto, userAgent, ipAddress);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { message: result.message, user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and set HttpOnly cookies' })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent = 'Unknown Device',
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, userAgent, ipAddress);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { user: result.user };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh tokens via Cookie or Body' })
  async refreshTokens(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent = 'Unknown Device',
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const rawToken = cookies?.['refresh_token'] ?? dto.refreshToken;

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    const tokens = await this.authService.refreshTokens(
      rawToken,
      userAgent,
      ipAddress,
    );
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { message: 'Tokens refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout device, clear cookies, and blacklist access token',
  })
  async logout(
    @Req() req: Request,
    @CurrentUser() user: UserDocument,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const body = req.body as Record<string, string | undefined> | undefined;
    const rawRefreshToken: string | undefined =
      cookies?.['refresh_token'] ?? body?.['refreshToken'];

    const accessPayload = (
      req as unknown as {
        userPayload?: {
          jti?: string;
          exp?: number;
          sub: string;
          email: string;
        };
      }
    ).userPayload;

    await this.authService.logout(
      user._id.toString(),
      rawRefreshToken,
      accessPayload,
    );
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(
    @CurrentUser() user: UserDocument,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAllDevices(user._id.toString());
    clearAuthCookies(res);
    return { message: 'Logged out from all devices successfully' };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP' })
  resendOtp(@Body() dto: ResendOptDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token via email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('request-reactivation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request account reactivation OTP' })
  requestReactivation(@Body() dto: RequestReactivationDto) {
    return this.authService.requestReactivation(dto);
  }

  @Post('reactivate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and reactivate account' })
  reactivateAccount(@Body() dto: ReactivateAccountDto) {
    return this.authService.reactivateAccount(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user._id.toString(), dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all active device sessions for current user' })
  async getSessions(@CurrentUser() user: UserDocument) {
    return this.authService.getUserSessions(user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific device session by ID' })
  async revokeSession(
    @CurrentUser() user: UserDocument,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(user._id.toString(), sessionId);
  }
}

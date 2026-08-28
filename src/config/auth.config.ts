import { registerAs } from '@nestjs/config';

/**
 * Enterprise Auth Configuration
 */
export default registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptSaltRounds: 10,
  otpExpiryMinutes: 10,
  resetPasswordExpiryMinutes: 15,
}));
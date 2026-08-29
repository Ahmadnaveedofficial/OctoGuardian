import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(userId: string, email: string) {
    const tokenId = crypto.randomUUID(); // Unique JWT ID for tracking and blacklisting
    const payload: JwtPayload & { jti: string } = {
      sub: userId,
      email,
      jti: tokenId,
    };

    const accessExpiresIn =
      this.configService.get<JwtSignOptions['expiresIn']>(
        'JWT_ACCESS_EXPIRES_IN',
      ) || '15m';
    const refreshExpiresIn =
      this.configService.get<JwtSignOptions['expiresIn']>(
        'JWT_REFRESH_EXPIRES_IN',
      ) || '7d';

    const accessOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessOptions),
      this.jwtService.signAsync(payload, refreshOptions),
    ]);

    return { accessToken, refreshToken, tokenId };
  }
}

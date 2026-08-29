import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../../users/users.service';
import { Blacklist, BlacklistDocument } from '../schemas/blacklist.schema';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectModel(Blacklist.name)
    private readonly blacklistModel: Model<BlacklistDocument>,
  ) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        let token: string | null = null;

        const cookies = req.cookies as
          Record<string, string | undefined> | undefined;
        if (cookies && typeof cookies['access_token'] === 'string') {
          token = cookies['access_token'];
        }

        const authHeader = req.headers.authorization;
        if (!token && authHeader && typeof authHeader === 'string') {
          token = authHeader.replace('Bearer ', '');
        }

        return token;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload & { jti?: string; exp?: number },
  ) {
    // Logout route ke liye payload inject kar rahe hain
    (req as unknown as { userPayload?: typeof payload }).userPayload = payload;

    // Check if Access Token is blacklisted
    if (payload.jti) {
      const isBlacklisted = await this.blacklistModel.findOne({
        tokenId: payload.jti,
      });
      if (isBlacklisted) {
        throw new UnauthorizedException(
          'Session terminated. Token blacklisted.',
        );
      }
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive or deleted');
    }
    return user;
  }
}

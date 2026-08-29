import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { TokenModule } from './token/token.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password/password.service';
import { OtpService } from './otp/otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Session, SessionSchema } from './schemas/session.schema';
import { Blacklist, BlacklistSchema } from './schemas/blacklist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Blacklist.name, schema: BlacklistSchema },
    ]),
    forwardRef(() => UsersModule),
    MailModule,
    TokenModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, OtpService, JwtStrategy],
  exports: [AuthService, PasswordService],
})
export class AuthModule {}

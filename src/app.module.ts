import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { GitHubModule } from './github/github.module';
import { AuditModule } from './audit/audit.module';
import { McpModule } from './mcp/mcp.module';
import { GeminiModule } from './gemini/gemini.module';
import { ChatModule } from './chat/chat.module';
import authConfig from './config/auth.config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    // Global rate limiting: a generous default for all routes, with a much
    // stricter limit applied per-endpoint on auth/OTP routes (see
    // auth.controller.ts) to stop brute-force and OTP-guessing attacks.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    UsersModule,
    AuthModule,
    MailModule,
    CloudinaryModule,
    GitHubModule,
    AuditModule,
    McpModule,
    GeminiModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

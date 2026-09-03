import { Module } from '@nestjs/common';
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
  providers: [AppService],
})
export class AppModule {}

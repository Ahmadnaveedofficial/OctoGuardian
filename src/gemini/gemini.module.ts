import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { McpModule } from '../mcp/mcp.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => McpModule),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}

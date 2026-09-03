import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history')
  async getHistory(@CurrentUser() user: UserDocument) {
    return this.chatService.getHistory(user._id.toString());
  }

  @Post('message')
  async saveMessage(
    @CurrentUser() user: UserDocument,
    @Body()
    body: {
      role: 'user' | 'assistant';
      content: string;
      executedTool?: string;
      rawData?: unknown;
    },
  ) {
    return this.chatService.saveMessage({
      userId: user._id.toString(),
      role: body.role,
      content: body.content,
      executedTool: body.executedTool,
      rawData: body.rawData,
    });
  }

  @Delete('history')
  async clearHistory(@CurrentUser() user: UserDocument) {
    await this.chatService.clearHistory(user._id.toString());

    return {
      success: true,
      message: 'Chat history cleared',
    };
  }
}

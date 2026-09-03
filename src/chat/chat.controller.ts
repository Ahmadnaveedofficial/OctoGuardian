import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private getUserId(req: any): string {
    return String(req.user?.userId || req.user?.id || 'default-user');
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = this.getUserId(req);

    return this.chatService.getHistory(userId);
  }

  @Post('message')
  async saveMessage(
    @Req() req: any,
    @Body()
    body: {
      role: 'user' | 'assistant';
      content: string;
      executedTool?: string;
      rawData?: unknown;
    },
  ) {
    const userId = this.getUserId(req);

    return this.chatService.saveMessage({
      userId,
      role: body.role,
      content: body.content,
      executedTool: body.executedTool,
      rawData: body.rawData,
    });
  }

  @Delete('history')
  async clearHistory(@Req() req: any) {
    const userId = this.getUserId(req);

    await this.chatService.clearHistory(userId);

    return {
      success: true,
      message: 'Chat history cleared',
    };
  }
}

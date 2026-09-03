import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessage } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly chatModel: Model<ChatMessage>,
  ) {}

  async getHistory(userId: string): Promise<ChatMessage[]> {
    return this.chatModel.find({ userId }).sort({ createdAt: 1 }).exec();
  }

  async saveMessage(data: {
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    executedTool?: string;
    rawData?: unknown;
  }): Promise<ChatMessage> {
    return this.chatModel.create(data);
  }

  async clearHistory(userId: string): Promise<void> {
    await this.chatModel.deleteMany({ userId }).exec();
  }
}

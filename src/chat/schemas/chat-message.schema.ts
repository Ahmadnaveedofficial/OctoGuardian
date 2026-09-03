import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ type: String, required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ required: true })
  content: string;

  @Prop()
  executedTool?: string;

  @Prop({ type: Object })
  rawData?: unknown;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
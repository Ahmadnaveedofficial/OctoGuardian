import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PendingActionDocument = PendingAction & Document;

@Schema({ timestamps: true })
export class PendingAction {
  @Prop({ required: true, unique: true, index: true })
  confirmationToken!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  toolName!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, any>;

  @Prop({ required: true, type: Date, expires: 300 }) // Auto cleanup after 5 minutes
  expiresAt!: Date;
}

export const PendingActionSchema = SchemaFactory.createForClass(PendingAction);

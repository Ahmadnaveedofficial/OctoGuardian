import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
}

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  toolName!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ type: String, default: null })
  repository?: string;

  @Prop({ type: Object, default: {} })
  parameters?: Record<string, unknown>;

  @Prop({
    type: String,
    enum: Object.values(AuditStatus),
    default: AuditStatus.SUCCESS,
  })
  status!: AuditStatus;

  @Prop({ type: String, default: null })
  failureReason?: string;

  @Prop({ type: Number, default: 0 })
  executionTimeMs?: number;

  @Prop({ type: String, default: '127.0.0.1' })
  ipAddress!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ userId: 1, createdAt: -1 });

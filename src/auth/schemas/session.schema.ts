import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  refreshTokenHash!: string;

  @Prop({ required: true })
  userAgent!: string;

  @Prop({ required: true })
  ipAddress!: string;

  @Prop({ required: true, type: Date, expires: 0 }) // TTL Index: Expire hote hi Mongo auto-delete kar dega
  expiresAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

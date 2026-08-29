import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BlacklistDocument = Blacklist & Document;

@Schema({ timestamps: true })
export class Blacklist {
  @Prop({ required: true, unique: true, index: true })
  tokenId!: string; // JWT ki unique jti ID

  @Prop({ required: true, type: Date, expires: 0 }) // Access Token expire hone ke waqt auto cleanup kar dega
  expiresAt!: Date;
}

export const BlacklistSchema = SchemaFactory.createForClass(Blacklist);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Gender } from '../enums/gender.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, type: String })
  fullName!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    type: String,
  })
  email!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    type: String,
  })
  username!: string;

  @Prop({ required: true, select: false, type: String })
  password!: string;

  @Prop({ enum: Gender, default: Gender.MALE, type: String })
  gender?: Gender;

  @Prop({ default: null, type: String })
  phone?: string | null;

  @Prop({ default: null, type: String })
  address?: string | null;

  @Prop({ default: null, type: Date })
  dateOfBirth?: Date | null;

  @Prop({ default: null, type: String })
  cnic?: string | null;

  @Prop({ default: null, type: String })
  avatar?: string | null;

  @Prop({ default: null, type: String })
  avatarPublicId?: string | null;

  @Prop({ default: null, select: false, type: String })
  refreshTokenHash?: string | null;

  @Prop({ default: true, type: Boolean })
  isActive!: boolean;

  @Prop({ default: null, type: Date })
  deactivatedAt?: Date | null;

  @Prop({ default: false, type: Boolean })
  isVerified!: boolean;

  @Prop({ default: null, select: false, type: String })
  otp?: string | null;

  @Prop({ default: null, select: false, type: Date })
  otpExpiry?: Date | null;

  @Prop({ default: null, select: false, type: String })
  resetPasswordToken?: string | null;

  @Prop({ default: null, select: false, type: Date })
  resetPasswordExpiry?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

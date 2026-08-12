import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
    index: true,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    required: false,
  })
  password?: string;

  @Prop({
    trim: true,
  })
  phone?: string;

  @Prop({
    trim: true,
  })
  address?: string;

  @Prop()
  dob?: string;

  @Prop({
    enum: ['Male', 'Female', 'Other'],
  })
  gender?: string;

  @Prop({
    trim: true,
  })
  cnic?: string;

  @Prop({
    type: {
      public_id: String,
      url: String,
    },
  })
  image?: {
    public_id: string;
    url: string;
  };

  @Prop()
  refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

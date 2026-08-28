import { Gender } from '../enums/gender.enum';

export interface IUser {
  fullName: string;
  email: string;
  username: string;
  password?: string;
  avatar?: string;
  avatarPublicId?: string;
  gender?: Gender;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  cnic?: string;
  isActive: boolean;
  isVerified: boolean;
  deactivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

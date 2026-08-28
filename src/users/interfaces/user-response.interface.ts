import { Gender } from '../enums/gender.enum';

export interface IUserResponse {
  id: string;
  fullName: string;
  email: string;
  username: string;
  avatar?: string | null;
  gender?: Gender;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;
  cnic?: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

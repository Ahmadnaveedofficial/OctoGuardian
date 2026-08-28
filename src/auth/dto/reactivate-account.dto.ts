import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ReactivateAccountDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

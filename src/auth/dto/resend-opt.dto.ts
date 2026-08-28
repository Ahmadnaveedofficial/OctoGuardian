import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendOptDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

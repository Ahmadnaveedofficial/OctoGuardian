import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestReactivationDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

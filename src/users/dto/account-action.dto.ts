import { IsNotEmpty, IsString } from 'class-validator';

export class AccountActionDto {
  @IsNotEmpty()
  @IsString()
  password: string;
}

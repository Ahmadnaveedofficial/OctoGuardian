import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PromptDto {
  @ApiProperty({
    example: 'Meri GitHub repositories ki list dikhao',
    description: 'Natural language instruction for GitHub operations',
  })
  @IsNotEmpty()
  @IsString()
  prompt!: string;
}

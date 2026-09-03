import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Legacy/body fallback for non-browser clients. Browser clients should use
   * the HttpOnly refresh_token cookie and therefore omit this field.
   */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

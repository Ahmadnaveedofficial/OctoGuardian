import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class OtpService {
  generateOtp(): { otp: string; expiresAt: Date } {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return { otp, expiresAt };
  }

  validateOtp(storedOtp: string, storedExpiry: Date, inputOtp: string): void {
    if (!storedOtp || !storedExpiry)
      throw new BadRequestException('No active OTP found');
    if (new Date() > storedExpiry)
      throw new BadRequestException('OTP has expired');
    if (storedOtp !== inputOtp)
      throw new BadRequestException('Invalid OTP entered');
  }
}

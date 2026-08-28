import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Transactional Email Service via Nodemailer
 */
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Dispatches OTP Code for Registration and Reactivation
   */
  async sendOtpEmail(
    to: string,
    otp: string,
    subject = 'Verification Code',
  ): Promise<void> {
    const mailOptions = {
      from: `"Authentication System" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Security Verification</h2>
          <p>Your OTP verification code is:</p>
          <h1 style="color: #2563eb; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`OTP mail sent to ${to}`);
  }

  /**
   * Dispatches Password Reset Token
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const mailOptions = {
      from: `"Security Team" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'Reset Password Request',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Your security token to reset your password is:</p>
          <p style="background: #f1f5f9; padding: 10px; font-weight: bold;">${token}</p>
          <p>This token is valid for 15 minutes.</p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

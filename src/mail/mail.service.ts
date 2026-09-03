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
    subject = 'OctoGuardian Security Verification',
  ): Promise<void> {
    const mailOptions = {
      from: `"OctoGuardian Security" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject,
      html: `
        <div style="background-color: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; border-radius: 12px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            
            <!-- Header -->
            <div style="background-color: #09090b; padding: 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <span style="font-size: 20px; font-weight: bold; color: #10b981; letter-spacing: -0.5px; font-family: monospace;">
                🐙 OctoGuardian <span style="font-size: 11px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: 4px; color: #34d399;">v1.0</span>
              </span>
            </div>

            <!-- Body Content -->
            <div style="padding: 32px 24px;">
              <p style="font-size: 12px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; color: #10b981; margin-bottom: 8px;">Zero-Trust Verification</p>
              <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px;">Security Verification Code</h2>
              <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px;">
                You have requested a secure action on your OctoGuardian workspace. Use the verification code below to proceed:
              </p>

              <!-- OTP Box -->
              <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #34d399; letter-spacing: 8px;">${otp}</span>
              </div>

              <p style="font-size: 12px; color: #71717a; margin: 0;">
                ⏱️ This code will expire in <strong style="color: #d4d4d8;">10 minutes</strong>. If you didn't request this, please ignore this email.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #09090b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a;">
              <p style="font-size: 11px; color: #52525b; margin: 0; font-family: monospace;">
                Autonomous Git Orchestration Engine &bull; Secure Transmission
              </p>
            </div>

          </div>
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
      from: `"OctoGuardian Security" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject: 'OctoGuardian Password Reset Request',
      html: `
        <div style="background-color: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; border-radius: 12px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            
            <!-- Header -->
            <div style="background-color: #09090b; padding: 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <span style="font-size: 20px; font-weight: bold; color: #10b981; letter-spacing: -0.5px; font-family: monospace;">
                🐙 OctoGuardian <span style="font-size: 11px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: 4px; color: #34d399;">v1.0</span>
              </span>
            </div>

            <!-- Body Content -->
            <div style="padding: 32px 24px;">
              <p style="font-size: 12px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; margin-bottom: 8px;">Account Security</p>
              <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h2>
              <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px;">
                We received a request to reset the password for your OctoGuardian account. Copy the security token below:
              </p>

              <!-- Token Box -->
              <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; word-break: break-all;">
                <span style="font-family: monospace; font-size: 14px; font-weight: bold; color: #fbbf24; letter-spacing: 1px;">${token}</span>
              </div>

              <p style="font-size: 12px; color: #71717a; margin: 0;">
                ⏱️ This security token is valid for <strong style="color: #d4d4d8;">15 minutes</strong>. Do not share this token with anyone.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #09090b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a;">
              <p style="font-size: 11px; color: #52525b; margin: 0; font-family: monospace;">
                Autonomous Git Orchestration Engine &bull; Zero-Trust Matrix
              </p>
            </div>

          </div>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Password reset email sent to ${to}`);
  }
}

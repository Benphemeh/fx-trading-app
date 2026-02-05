import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;

  constructor(private readonly config: ConfigService) {
    const resendKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (resendKey && resendKey.startsWith('re_')) {
      this.resend = new Resend(resendKey);
      this.logger.log('Using Resend for email delivery');
    } else {
      const mailUser = this.config.get<string>('MAIL_USER');
      const mailPass = this.config.get<string>('MAIL_PASSWORD');
      if (mailUser && mailPass) {
        const port = this.config.get<number>('MAIL_PORT') ?? 587;
        const secure = port === 465;
        this.transporter = nodemailer.createTransport({
          host: this.config.get<string>('MAIL_HOST'),
          port,
          secure,
          auth: {
            user: mailUser,
            pass: mailPass,
          },
        });
        this.logger.log('Using SMTP for email delivery');
      } else {
        this.logger.warn(
          'No mail provider configured. OTP will be logged in terminal. Set RESEND_API_KEY or MAIL_USER/MAIL_PASSWORD in .env and restart.',
        );
      }
    }
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const subject = 'Your FX Trading verification code';
    const text = `Your verification code is: ${otp}. It expires in 10 minutes.`;
    const html = `<p>Your verification code is: <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`;

    if (this.resend) {
      const from = 'FX Trading <onboarding@resend.dev>';
      const { error } = await this.resend.emails.send({
        from,
        to: [to],
        subject,
        html,
      });
      if (error) {
        throw new Error(`Resend failed: ${JSON.stringify(error)}`);
      }
      return;
    }

    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM') || 'FX Trading <noreply@fxtrading.com>',
        to,
        subject,
        text,
        html,
      });
      return;
    }

    throw new Error(
      'No mail provider configured. Set RESEND_API_KEY (recommended) or MAIL_USER/MAIL_PASSWORD in .env',
    );
  }
}

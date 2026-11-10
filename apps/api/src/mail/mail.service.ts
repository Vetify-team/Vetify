import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends account emails through Resend's HTTP API. Without RESEND_API_KEY it
 * sends nothing: in development the email is printed so the flow can be
 * tried locally; elsewhere only the skip is logged, never the content (a
 * reset link in the logs would be a working credential).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(email: Email): Promise<void> {
    const key = this.config.get('RESEND_API_KEY', { infer: true });
    if (!key) {
      if (this.config.get('NODE_ENV', { infer: true }) === 'development')
        this.logger.log(`Email not sent (no RESEND_API_KEY):\n${email.text}`);
      else
        this.logger.warn(`Email "${email.subject}" skipped: no RESEND_API_KEY`);
      return;
    }

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(
        `Resend answered ${response.status}: ${await response.text()}`,
      );
  }
}

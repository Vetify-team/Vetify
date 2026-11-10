import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';

/** ONVO's API; the key, not the host, decides test or live mode. */
const ONVO_API = 'https://api.onvopay.com';

export type OnvoMode = 'test' | 'live';

export interface OnvoCheckoutRequest {
  orderNumber: string;
  /** In the currency's minor unit (céntimos for CRC). */
  amountMinor: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  redirectUrl: string;
  cancelUrl: string;
}

/** GET /v1/checkout/sessions/{id} (fields we rely on). */
export interface OnvoCheckoutSession {
  id?: string;
  url?: string;
  status?: string;
  paymentStatus?: string;
  paymentIntentId?: string | null;
  mode?: string;
  amountTotal?: number;
  currency?: string;
  metadata?: Record<string, unknown> | null;
}

/** GET /v1/payment-intents/{id} (fields we rely on). */
export interface OnvoPaymentIntent {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  mode?: string;
}

export class OnvoError extends Error {}

/**
 * Minimal ONVO client for hosted Checkout: create a one-time session and read
 * a session or payment intent back. The secret key stays on the server. Any
 * answer other than 2xx is an error, never "nothing yet".
 */
@Injectable()
export class OnvoClient {
  private readonly logger = new Logger(OnvoClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(this.config.get('ONVO_SECRET_KEY', { infer: true }));
  }

  /** The mode the configured key operates in. */
  get mode(): OnvoMode {
    return this.config
      .get('ONVO_SECRET_KEY', { infer: true })
      .startsWith('onvo_live_')
      ? 'live'
      : 'test';
  }

  /** Creates a one-time Checkout session and returns its id and URL. */
  async createCheckout(
    req: OnvoCheckoutRequest,
  ): Promise<{ id: string; url: string }> {
    const session = await this.request<OnvoCheckoutSession>(
      'POST',
      '/v1/checkout/sessions/one-time-link',
      {
        lineItems: [
          {
            quantity: 1,
            unitAmount: req.amountMinor,
            currency: req.currency,
            description: req.description,
          },
        ],
        customerName: req.customerName,
        customerEmail: req.customerEmail,
        redirectUrl: req.redirectUrl,
        cancelUrl: req.cancelUrl,
        metadata: { orderNumber: req.orderNumber },
      },
    );
    if (typeof session.id !== 'string' || typeof session.url !== 'string') {
      throw new OnvoError('ONVO did not return a checkout session');
    }
    return { id: session.id, url: session.url };
  }

  getSession(id: string): Promise<OnvoCheckoutSession> {
    return this.request(
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(id)}`,
    );
  }

  getPaymentIntent(id: string): Promise<OnvoPaymentIntent> {
    return this.request('GET', `/v1/payment-intents/${encodeURIComponent(id)}`);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.get('ONVO_SECRET_KEY', { infer: true })}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    };
    if (body) init.body = JSON.stringify(body);
    let res: Response;
    try {
      res = await fetch(`${ONVO_API}${path}`, init);
    } catch {
      throw new OnvoError(`ONVO ${method} ${path} did not answer`);
    }
    const json = (await res.json().catch(() => null)) as T | null;
    if (!res.ok || !json || typeof json !== 'object') {
      // The body may echo customer data; log only the status and ONVO's code.
      const code = (json as { code?: unknown } | null)?.code;
      const detail =
        typeof code === 'string' || typeof code === 'number' ? ` ${code}` : '';
      this.logger.warn(
        `ONVO ${method} ${path.split('/').slice(0, 4).join('/')} failed: ${res.status}${detail}`,
      );
      throw new OnvoError(`ONVO request failed (${res.status})`);
    }
    return json;
  }
}

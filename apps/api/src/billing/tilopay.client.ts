import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';

/** Tilopay API host; test and production share it (developers/entornos). */
const TILOPAY_HOST = 'https://app.tilopay.com';

export interface TilopayBuyer {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
}

export interface TilopayPaymentRequest {
  orderNumber: string;
  amount: string;
  currency: string;
  redirect: string;
  buyer: TilopayBuyer;
}

/** One item of POST /api/v1/consult `response` (fields we rely on). */
export interface TilopayTransaction {
  id_tilopay?: number | string;
  orderNumber?: string;
  amount?: string;
  currency?: string;
  code?: string | number;
  response?: string;
  environment?: string;
}

export class TilopayError extends Error {}

/**
 * Minimal Tilopay client for the hosted payment page: log in, create the
 * payment URL, and consult an order. Credentials stay on the server; the API
 * token (24 h) is cached and renewed a minute before it expires.
 */
@Injectable()
export class TilopayClient {
  private readonly logger = new Logger(TilopayClient.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get('TILOPAY_API_USER', { infer: true }) &&
      this.config.get('TILOPAY_PASSWORD', { infer: true }) &&
      this.config.get('TILOPAY_KEY', { infer: true }),
    );
  }

  /** Returns the URL of Tilopay's hosted payment form. */
  async createPayment(req: TilopayPaymentRequest): Promise<string> {
    const body = {
      redirect: req.redirect,
      key: this.config.get('TILOPAY_KEY', { infer: true }),
      amount: req.amount,
      currency: req.currency,
      orderNumber: req.orderNumber,
      capture: '1',
      billToFirstName: req.buyer.firstName,
      billToLastName: req.buyer.lastName,
      // The hosted form collects the card; Tilopay still requires an address.
      billToAddress: 'San José',
      billToAddress2: 'San José',
      billToCity: 'San José',
      billToState: 'CR-SJ',
      billToZipPostCode: '10101',
      billToCountry: 'CR',
      billToTelephone: req.buyer.telephone,
      billToEmail: req.buyer.email,
      subscription: '0',
      platform: 'api',
      token_version: 'v2',
    };
    const res = await this.post('/api/v1/processPayment', body);
    if (String(res.type) !== '100' || typeof res.url !== 'string') {
      this.logger.warn(`processPayment rejected: type=${String(res.type)}`);
      throw new TilopayError('Tilopay did not create the payment form');
    }
    return res.url;
  }

  /** The transaction Tilopay recorded for an order, or null if there is none. */
  async consult(orderNumber: string): Promise<TilopayTransaction | null> {
    const res = await this.post('/api/v1/consult', {
      key: this.config.get('TILOPAY_KEY', { infer: true }),
      orderNumber,
      merchantId: '',
    });
    const items = Array.isArray(res.response)
      ? (res.response as TilopayTransaction[])
      : [];
    // Several attempts on one order may be listed; an approval wins.
    return (
      items.find((t) => String(t.code) === '1') ??
      items[items.length - 1] ??
      null
    );
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const token = await this.apiToken();
    const res = await fetch(`${TILOPAY_HOST}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    // "An HTTP 200 does not mean success": callers check the body.
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (res.status === 401) this.token = null;
    if (res.status >= 500)
      throw new TilopayError(`Tilopay ${path} failed (${res.status})`);
    return json;
  }

  private async apiToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000)
      return this.token.value;
    const res = await fetch(`${TILOPAY_HOST}/api/v1/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        apiuser: this.config.get('TILOPAY_API_USER', { infer: true }),
        password: this.config.get('TILOPAY_PASSWORD', { infer: true }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !json.access_token)
      throw new TilopayError('Tilopay login failed');
    const seconds = Number(json.expires_in) || 3600;
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + seconds * 1000,
    };
    return this.token.value;
  }
}

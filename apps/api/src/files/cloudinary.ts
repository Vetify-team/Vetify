import { createHash } from 'node:crypto';

/**
 * Cloudinary signing, written against the official SDK's algorithm (see
 * cloudinary.spec.ts) so the API needs no SDK. Every file is stored with
 * `type: authenticated`: no URL to it works without a signature made with
 * the API secret, which never leaves the server.
 */
export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const API = 'https://api.cloudinary.com/v1_1';
const CDN = 'https://res.cloudinary.com';
export const STORAGE_TYPE = 'authenticated';

/** `cloudinary://<api_key>:<api_secret>@<cloud_name>`, as the console shows it. */
export function parseCloudinaryUrl(
  value: string,
): CloudinaryCredentials | null {
  const match = /^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([\w-]+)$/.exec(value);
  if (!match) return null;
  const [, apiKey, apiSecret, cloudName] = match;
  return { apiKey: apiKey!, apiSecret: apiSecret!, cloudName: cloudName! };
}

/**
 * Signature of upload and API parameters: sorted `key=value` pairs joined
 * with `&` (an `&` inside a pair escaped, signature version 2) plus the
 * secret, SHA-256 in hex (Cloudinary also accepts its older SHA-1 default;
 * checked against the live service for uploads and download links).
 * Cloudinary rejects a request that carries any parameter left out of the
 * signature.
 */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`.replace(/&/g, '%26'))
    .join('&');
  return createHash('sha256')
    .update(toSign + apiSecret)
    .digest('hex');
}

export const uploadUrl = (c: CloudinaryCredentials) =>
  `${API}/${c.cloudName}/image/upload`;

/** Admin API path of authenticated images (resource lookup and deletion). */
export const resourcesUrl = (c: CloudinaryCredentials) =>
  `${API}/${c.cloudName}/resources/image/${STORAGE_TYPE}`;

export const basicAuth = (c: CloudinaryCredentials) =>
  `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64')}`;

/**
 * Signed CDN URL of a transformed image. The signature covers the
 * transformation and the file, so nobody can ask for another size or the
 * original. It does not expire: use it only for low-sensitivity images.
 *
 * The CDN only accepts this format on the free plan: the first 8 characters
 * of SHA-1 over the path plus the secret. The 32-character SHA-256 form
 * ("long URL signatures") is answered 401 without the paid feature.
 */
export function signedImageUrl(
  c: CloudinaryCredentials,
  publicId: string,
  transformation: string,
  format: string,
): string {
  const source = `${publicId}.${format}`;
  const signature = createHash('sha1') // NOSONAR: format fixed by Cloudinary's CDN, see above
    .update(`${transformation}/${source}${c.apiSecret}`)
    .digest('base64')
    .slice(0, 8)
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `${CDN}/${c.cloudName}/image/${STORAGE_TYPE}/s--${signature}--/${transformation}/v1/${source}`;
}

/** Download link of the original file that stops working at `expiresAt` (seconds). */
export function privateDownloadUrl(
  c: CloudinaryCredentials,
  publicId: string,
  format: string,
  expiresAt: number,
  timestamp: number,
): string {
  const params = {
    timestamp,
    public_id: publicId,
    format,
    type: STORAGE_TYPE,
    expires_at: expiresAt,
  };
  const query = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
    signature: signParams(params, c.apiSecret),
    api_key: c.apiKey,
  });
  return `${API}/${c.cloudName}/image/download?${query.toString()}`;
}

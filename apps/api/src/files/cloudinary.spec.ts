import { describe, expect, it } from 'vitest';
import {
  parseCloudinaryUrl,
  privateDownloadUrl,
  signParams,
  signedImageUrl,
} from './cloudinary.js';

// Expected values were produced once with the official SDK (cloudinary@2.7.0:
// utils.api_sign_request, url with sign_url, utils.private_download_url)
// using these fake credentials.
const creds = {
  cloudName: 'demo-cloud',
  apiKey: '123456789012345',
  apiSecret: 'test-secret-not-real',
};
const id =
  'pets/11111111-1111-4111-8111-111111111111/photo/22222222-2222-4222-8222-222222222222';

describe('cloudinary signing', () => {
  it('signs upload parameters like the SDK', () => {
    expect(
      signParams(
        {
          timestamp: 1700000000,
          public_id: id,
          type: 'authenticated',
          allowed_formats: 'jpg,png,webp,heic',
          overwrite: 'false',
        },
        creds.apiSecret,
      ),
    ).toBe('406d126b6e4cd927391733176b42141336572230');
  });

  it('signs a transformed image URL like the SDK', () => {
    expect(
      signedImageUrl(creds, id, 'c_fill,g_auto,h_512,q_auto,w_512', 'jpg'),
    ).toBe(
      `https://res.cloudinary.com/demo-cloud/image/authenticated/s--6C-FMPY2--/c_fill,g_auto,h_512,q_auto,w_512/v1/${id}.jpg`,
    );
  });

  it('builds an expiring download URL like the SDK', () => {
    const url = new URL(
      privateDownloadUrl(creds, id, 'pdf', 1700000300, 1700000000),
    );
    expect(url.origin + url.pathname).toBe(
      'https://api.cloudinary.com/v1_1/demo-cloud/image/download',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      timestamp: '1700000000',
      public_id: id,
      format: 'pdf',
      type: 'authenticated',
      expires_at: '1700000300',
      signature: '97457f1cb83d904fb77f1c4efd897c71dd519f4c',
      api_key: '123456789012345',
    });
  });

  it('parses CLOUDINARY_URL and rejects anything else', () => {
    expect(
      parseCloudinaryUrl('cloudinary://123456789012345:abc-DEF_1@my-cloud'),
    ).toEqual({
      apiKey: '123456789012345',
      apiSecret: 'abc-DEF_1',
      cloudName: 'my-cloud',
    });
    expect(parseCloudinaryUrl('https://example.com')).toBeNull();
    expect(parseCloudinaryUrl('')).toBeNull();
  });
});

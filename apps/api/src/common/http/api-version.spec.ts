import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { apiVersion } from './api-version.js';

const run = (url: string, header?: string) => {
  const req = {
    url,
    header: (name: string) => (name === 'x-api-version' ? header : undefined),
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  const next = vi.fn() as NextFunction;
  apiVersion(req, res as unknown as Response, next);
  return { req, res, next };
};

describe('apiVersion', () => {
  it('lets a versioned URL through and echoes the version', () => {
    const { next, res } = run('/api/v1/pets');
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
  });

  it('rewrites the header form to the URL form', () => {
    const { req, next } = run('/api/pets/123?x=1', '1');
    expect(req.url).toBe('/api/v1/pets/123?x=1');
    expect(next).toHaveBeenCalled();
  });

  it('rejects an unversioned request without the header', () => {
    const { res, next } = run('/api/pets');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'API_VERSION_UNSUPPORTED' }),
    );
  });

  it('rejects an unsupported version and a header that contradicts the URL', () => {
    expect(run('/api/pets', '2').res.status).toHaveBeenCalledWith(400);
    expect(run('/api/v1/pets', '2').res.status).toHaveBeenCalledWith(400);
  });

  it('leaves the docs and non-API paths alone', () => {
    expect(run('/api/docs').next).toHaveBeenCalled();
    expect(run('/api/docs-json').next).toHaveBeenCalled();
    expect(run('/favicon.ico').next).toHaveBeenCalled();
  });
});

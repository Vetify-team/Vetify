/** Claims shared by every token the API signs. */
export const ISSUER = 'vetify-api';
export const ACCESS_AUDIENCE = 'vetify-access';
export const REFRESH_AUDIENCE = 'vetify-refresh';
/** Pinned: a token signed with any other algorithm (or `none`) is rejected. */
export const ALGORITHM = 'HS256' as const;

/**
 * The refresh token only travels in this cookie: HttpOnly (scripts cannot
 * read it, so XSS cannot steal the session), Secure in production,
 * SameSite=Strict and scoped to /api.
 */
export const REFRESH_COOKIE = 'vetify_refresh';
export const REFRESH_COOKIE_PATH = '/api';

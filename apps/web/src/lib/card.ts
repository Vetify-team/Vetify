/**
 * The public card's link: /verificar#<token> on the owner site. The token
 * goes in the fragment, so it never reaches a server log or a referrer.
 * Pure logic, tested on its own.
 */
export const cardVerifyUrl = (origin: string, token: string): string =>
  `${origin}/verificar#${token}`;

/** A card token: a signed value of URL-safe characters (it has dots). */
const TOKEN = /^[A-Za-z0-9._~-]{16,512}$/;

/**
 * The token of a scanned or pasted card link, or null when it is not a
 * Vetify card of this environment. `ownerOrigin` is the owner site of this
 * deployment (staging cards do not open in production, and the other way
 * round). Accepts /verificar#<token> and the older /verificar/<token>.
 */
export function tokenFromCardLink(text: string, ownerOrigin: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== new URL(ownerOrigin).origin) return null;
  let token: string | null = null;
  if (url.pathname === "/verificar") token = url.hash.slice(1);
  else {
    const match = /^\/verificar\/([^/]+)$/.exec(url.pathname);
    if (match) token = decodeURIComponent(match[1]!);
  }
  return token && TOKEN.test(token) ? token : null;
}

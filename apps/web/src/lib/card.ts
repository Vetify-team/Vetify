/**
 * The public card's link: /verificar#<token> on the owner site. The token
 * goes in the fragment, so it never reaches a server log or a referrer.
 * Pure logic, tested on its own.
 */
export const cardVerifyUrl = (origin: string, token: string): string =>
  `${origin}/verificar#${token}`;

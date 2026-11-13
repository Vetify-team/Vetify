import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from "@vetify/types";

/**
 * The clinic's link code as the owner types it: 8 characters of the code
 * alphabet (no I, L, O, 0 or 1, which are easy to confuse), shown XXXX-XXXX.
 * Pure logic, tested on its own; the input only paints it.
 */

export const CODE_LENGTH = LINK_CODE_LENGTH;
const ALLOWED = new Set(LINK_CODE_ALPHABET);

/**
 * What the input keeps from anything typed or pasted: upper case, only the
 * code's characters (the hyphen, spaces and anything else are dropped), at
 * most 8. "k7pq-4mxa" and "K7PQ 4MXA" both give "K7PQ4MXA".
 */
export function normalizeCode(raw: string): string {
  let code = "";
  for (const char of raw.toUpperCase()) {
    if (ALLOWED.has(char)) code += char;
    if (code.length === CODE_LENGTH) break;
  }
  return code;
}

/** "K7PQ-4MXA"; a partial code keeps its hyphen once past the fourth character. */
export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export const isComplete = (code: string): boolean => code.length === CODE_LENGTH;

/**
 * The box that shows the caret: the next one to fill, or the last when the
 * code is complete.
 */
export const activeBox = (code: string): number => Math.min(code.length, CODE_LENGTH - 1);

const FULL_CODE = new RegExp(
  `(?:^|[^${LINK_CODE_ALPHABET}])([${LINK_CODE_ALPHABET}]{4})[\s-]?([${LINK_CODE_ALPHABET}]{4})(?![${LINK_CODE_ALPHABET}])`,
);

/**
 * A pasted text: the whole code if it holds one ("Tu código: K7PQ-4MXA"),
 * else its characters added after what was already typed.
 */
export function codeFromPaste(current: string, pasted: string): string {
  const match = FULL_CODE.exec(pasted.toUpperCase());
  return match ? match[1]! + match[2]! : normalizeCode(current + pasted);
}

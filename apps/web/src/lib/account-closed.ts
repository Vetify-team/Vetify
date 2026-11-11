/**
 * One-shot note from Ajustes → Cerrar cuenta to the login page. Kept in this
 * tab's sessionStorage, not in the URL, so a crafted link cannot show an
 * owner the "your account was deleted" message.
 */
const KEY = "vetify:account-closed";

export function markAccountClosed(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked: the login page just shows no notice.
  }
}

/** True once, right after the account was closed in this tab. */
export function takeAccountClosed(): boolean {
  try {
    const closed = sessionStorage.getItem(KEY) === "1";
    sessionStorage.removeItem(KEY);
    return closed;
  } catch {
    return false;
  }
}

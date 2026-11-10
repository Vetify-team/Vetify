"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's own install prompt (Chrome, Edge, Samsung Internet on
 * Android and desktop). It fires on the app's own host once the PWA is
 * installable; we keep it so a button can open the install dialog. Safari on
 * iPhone has no such API: there the user adds it from the Share menu.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "prompt"; install: () => Promise<boolean> }
  | { kind: "ios" }
  | { kind: "unavailable" };

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for our button instead of the browser's mini-infobar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** Opens the browser's install dialog; true when the user accepted. */
async function install(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac with touch.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Snapshots must be stable between changes, so each kind is one object.
const INSTALLED: InstallState = { kind: "installed" };
const PROMPT: InstallState = { kind: "prompt", install };
const IOS: InstallState = { kind: "ios" };
const UNAVAILABLE: InstallState = { kind: "unavailable" };

function snapshot(): InstallState {
  if (installed || isStandalone()) return INSTALLED;
  if (deferred) return PROMPT;
  return isIos() ? IOS : UNAVAILABLE;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether and how this browser can install the app; null while rendering on the server. */
export function useInstall(): InstallState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

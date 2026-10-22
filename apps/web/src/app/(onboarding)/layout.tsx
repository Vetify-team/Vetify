import type { ReactNode } from "react";

/** The sign-up wizard: full screen, one column, no app chrome. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {children}
    </main>
  );
}

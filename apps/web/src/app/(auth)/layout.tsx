import type { ReactNode } from "react";

/** Pantallas sin sesión: login y registro. */
export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

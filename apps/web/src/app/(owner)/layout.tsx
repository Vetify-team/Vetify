import type { ReactNode } from "react";
import { OwnerNav } from "@/components/owner/owner-nav";
import { ProtectedRoute } from "@/components/protected-route";

/** Owner area: their pets, the record and the permissions they grant. */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <OwnerNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-28 md:pb-12">
        <ProtectedRoute role="owner">{children}</ProtectedRoute>
      </main>
    </div>
  );
}

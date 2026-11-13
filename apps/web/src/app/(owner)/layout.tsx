import type { ReactNode } from "react";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { OwnerNav } from "@/components/owner/owner-nav";
import { ProtectedRoute } from "@/components/protected-route";
import { OwnerTour } from "@/components/tour/first-run-tour";

/** Owner area: their pets, the record and the permissions they grant. */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <OwnerNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-28">
        <ProtectedRoute role="owner">
          {/* Narrow by default; a screen with [data-wide] (pets, a pet's panel) uses the width. */}
          <div className="mx-auto w-full max-w-xl has-[[data-wide]]:max-w-5xl">
            {children}
          </div>
          <OwnerTour />
          <AssistantDock mode="owner" />
        </ProtectedRoute>
      </main>
    </div>
  );
}

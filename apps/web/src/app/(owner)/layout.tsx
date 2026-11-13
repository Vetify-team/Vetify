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
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-28">
        <ProtectedRoute role="owner">
          {children}
          <OwnerTour />
          <AssistantDock mode="owner" />
        </ProtectedRoute>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { ProtectedRoute } from "@/components/protected-route";
import { ClinicTour } from "@/components/tour/first-run-tour";

/** Clinic portal: only patients whose owner granted an active permission. */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <ClinicNav />
      <main className="w-full min-w-0 flex-1 px-5 pt-8 pb-28 lg:px-10">
        <ProtectedRoute role="clinic">
          {children}
          <ClinicTour />
          <AssistantDock mode="clinic" />
        </ProtectedRoute>
      </main>
    </div>
  );
}

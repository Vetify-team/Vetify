import type { ReactNode } from "react";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { ProtectedRoute } from "@/components/protected-route";

/** Clinic portal: only patients whose owner granted an active permission. */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <ClinicNav />
      <main className="w-full min-w-0 flex-1 px-5 py-8 lg:px-10">
        <ProtectedRoute role="clinic">{children}</ProtectedRoute>
      </main>
    </div>
  );
}

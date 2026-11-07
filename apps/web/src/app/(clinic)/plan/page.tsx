import type { Metadata } from "next";
import { PlanPanel } from "@/components/billing/plan-panel";
import { ScreenTitle } from "@/components/system";

export const metadata: Metadata = { title: "Plan · Vetify" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle label="Tu clínica" title="Plan" />
      <PlanPanel role="clinic" />
    </div>
  );
}

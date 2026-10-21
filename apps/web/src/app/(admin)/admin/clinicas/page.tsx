import type { Metadata } from "next";
import { ClinicReview } from "@/components/admin/clinic-review";

export const metadata: Metadata = { title: "Clínicas · Vetify" };

export default function Page() {
  return <ClinicReview />;
}

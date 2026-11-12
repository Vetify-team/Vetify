import type { Metadata } from "next";
import { ClinicCards } from "@/components/clinic/cards";

export const metadata: Metadata = { title: "Carnés" };

export default function Page() {
  return <ClinicCards />;
}

import type { Metadata } from "next";
import { HelpGuide } from "@/components/landing/help-guide";
import { CLINIC_GUIDE } from "@/components/landing/help-guides";

export const metadata: Metadata = {
  title: "Manual para clínicas",
  description: "Cómo usa una clínica el portal de Vetify, paso a paso.",
  alternates: { canonical: "/ayuda/clinicas" },
};

export default function Page() {
  return <HelpGuide guide={CLINIC_GUIDE} />;
}

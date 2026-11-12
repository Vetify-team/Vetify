import type { Metadata } from "next";
import { HelpGuide } from "@/components/landing/help-guide";
import { OWNER_GUIDE } from "@/components/landing/help-guides";

export const metadata: Metadata = {
  title: "Manual para dueños",
  description: "Cómo llevar el expediente de tu mascota en Vetify, paso a paso.",
  alternates: { canonical: "/ayuda/duenos" },
};

export default function Page() {
  return <HelpGuide guide={OWNER_GUIDE} />;
}

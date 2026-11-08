import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function Page() {
  return <OnboardingWizard />;
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { homeOf } from "@/components/protected-route";
import { useSession } from "@/hooks/useSession";
import {
  EMPTY_WIZARD,
  nextStep,
  previousStep,
  type StepId,
  type StepProps,
  type WizardData,
} from "@/lib/onboarding";
import { AccessStep, NameStep, RoleStep, WelcomeStep } from "./steps/account-steps";
import { ClinicReviewStep } from "./steps/clinic-review-step";
import {
  CreatingStep,
  PetDetailsStep,
  PetNameStep,
  SpeciesStep,
} from "./steps/pet-steps";
import { PlansStep } from "./steps/plans-step";
import { WizardShell } from "./wizard-shell";

const STEPS: Record<StepId, ComponentType<StepProps>> = {
  welcome: WelcomeStep,
  role: RoleStep,
  name: NameStep,
  access: AccessStep,
  species: SpeciesStep,
  petName: PetNameStep,
  petDetails: PetDetailsStep,
  creating: CreatingStep,
  clinicReview: ClinicReviewStep,
  plans: PlansStep,
};

/**
 * Sign-up as a guided sequence: account, first pet (or clinic review), plan.
 * The account is created at `access`; the rest uses the authenticated API.
 * On finishing, the user lands on their home, where the guided tour starts.
 */
export function OnboardingWizard() {
  const { loading, user } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<StepId>("welcome");
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);

  // Someone who arrives already signed in goes home. Checked once, on load:
  // the session this wizard creates must not trigger it.
  const checked = useRef(false);
  useEffect(() => {
    if (loading || checked.current) return;
    checked.current = true;
    if (user) router.replace(homeOf(user.role));
  }, [loading, user, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const update = useCallback(
    (patch: Partial<WizardData>) => setData((current) => ({ ...current, ...patch })),
    [],
  );
  const next = () => {
    const following = nextStep(data.role, step);
    if (following) setStep(following);
    else router.replace(homeOf(data.role));
  };
  const back = previousStep(data.role, step, data);
  const Step = STEPS[step];

  return (
    <WizardShell role={data.role} step={step} onBack={back && (() => setStep(back))}>
      <Step data={data} update={update} next={next} goTo={setStep} />
    </WizardShell>
  );
}

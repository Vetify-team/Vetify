"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
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
import { signUpRoleOf, siteOfHost } from "@/lib/sites";
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

const noSubscription = () => () => {};
const hostRole = () => signUpRoleOf(siteOfHost(window.location.host));

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
  // On the owner or clinic site the account type is already known.
  const fixedRole = useSyncExternalStore(noSubscription, hostRole, () => null);

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
    if (step === "welcome" && fixedRole) {
      update({ role: fixedRole, plan: fixedRole === "owner" ? "free" : "pilot" });
      return setStep("name");
    }
    const following = nextStep(data.role, step);
    if (following) setStep(following);
    else router.replace(homeOf(data.role));
  };
  const back =
    step === "name" && fixedRole ? "welcome" : previousStep(data.role, step, data);
  const Step = STEPS[step];

  return (
    <WizardShell role={data.role} step={step} onBack={back && (() => setStep(back))}>
      <Step data={data} update={update} next={next} goTo={setStep} />
    </WizardShell>
  );
}

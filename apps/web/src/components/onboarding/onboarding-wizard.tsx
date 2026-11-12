"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import {
  EMPTY_WIZARD,
  nextStep,
  previousStep,
  type StepId,
  type StepProps,
  type WizardData,
} from "@/lib/onboarding";
import { LANDING_PAGES, signUpRoleOf, siteHref, siteOfHost } from "@/lib/sites";
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

// A clinic's sign-up link opens /registro#clinica=<token>. The fragment never
// reaches a server; it is read once, kept here and removed from the URL.
let linkToken: string | null = null;
const readSignupToken = () => {
  const match = /^#clinica=([\w-]+)$/.exec(window.location.hash);
  if (match) linkToken = match[1]!;
  return linkToken;
};

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
  const [entered, setData] = useState<WizardData>(EMPTY_WIZARD);
  const signupToken = useSyncExternalStore(noSubscription, readSignupToken, () => null);
  const link = useQuery({
    queryKey: ["signup-link", signupToken],
    queryFn: () => api.previewSignupLink(signupToken!),
    enabled: !!signupToken,
    retry: false,
    staleTime: Infinity,
  });
  // On the owner or clinic site, or with a clinic's link, the account type
  // is already known.
  const hostFixedRole = useSyncExternalStore(noSubscription, hostRole, () => null);
  const fixedRole = signupToken ? "clinic" : hostFixedRole;
  // The link fixes the email and the plan and suggests the clinic name.
  const data: WizardData =
    signupToken && link.data
      ? {
          ...entered,
          role: "clinic",
          email: link.data.email,
          clinicName: entered.clinicName || link.data.clinicName,
          plan: link.data.plan,
          signupToken,
        }
      : entered;

  // Out of the address bar, history and screenshots once it is read.
  const linkSettled = !!signupToken && !link.isPending;
  useEffect(() => {
    if (linkSettled) window.history.replaceState(null, "", window.location.pathname);
  }, [linkSettled]);

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
      if (!signupToken)
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

  if (signupToken && link.isPending) return null;
  if (signupToken && link.error)
    return (
      <WizardShell role="clinic" step="welcome" onBack={null}>
        <div className="flex flex-1 flex-col gap-5 pt-6" role="alert">
          <h1 className="font-display text-4xl leading-tight">El enlace no sirve</h1>
          <p className="text-muted-foreground">{errorMessage(link.error)}</p>
          <Link
            href={siteHref("landing", LANDING_PAGES.clinics)}
            className="text-sm text-primary underline underline-offset-4"
          >
            Escribirle a Vetify
          </Link>
        </div>
      </WizardShell>
    );

  return (
    <WizardShell role={data.role} step={step} onBack={back && (() => setStep(back))}>
      <Step data={data} update={update} next={next} goTo={setStep} />
    </WizardShell>
  );
}

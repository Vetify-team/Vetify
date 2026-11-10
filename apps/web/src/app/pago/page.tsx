"use client";

import { PAID_PLANS } from "@vetify/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { keys } from "@/hooks/keys";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

/**
 * Where ONVO sends the browser back (with `cancelado=1` if the buyer left the
 * Checkout). The page only asks the API, which reads the order back from ONVO
 * before the plan changes.
 */
export default function PaymentReturnPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <p className="font-display text-5xl leading-none font-medium">Vetify</p>
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
          <PaymentResult />
        </Suspense>
      </div>
    </main>
  );
}

function PaymentResult() {
  const params = useSearchParams();
  const order = params.get("order");
  const cancelled = params.get("cancelado") === "1";
  const { loading, user } = useSession();
  const queryClient = useQueryClient();
  const confirm = useQuery({
    queryKey: ["payment", order],
    queryFn: () => api.confirmPayment(order!),
    enabled: Boolean(order && user && !cancelled),
    // ONVO may take a moment to record the result.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 4000 : false),
    retry: 1,
  });
  const status = confirm.data?.status;
  useEffect(() => {
    if (status === "approved")
      void queryClient.invalidateQueries({ queryKey: keys.billing });
  }, [status, queryClient]);

  const back = user?.role === "clinic" ? "/plan" : "/ajustes";
  const backLink = (
    <Link href={back} className={buttonVariants({ variant: "solido" })}>
      Volver a mi plan
    </Link>
  );

  if (!order)
    return <Message icon={CircleX} title="No encontramos el pago" action={backLink} />;
  if (cancelled) {
    return (
      <Message
        icon={CircleX}
        title="Cancelaste el pago"
        text="No se hizo ningún cobro. Podés volver a intentarlo cuando querás."
        action={backLink}
      />
    );
  }
  if (!loading && !user) {
    return (
      <Message
        icon={Clock}
        title="Iniciá sesión para confirmar el pago"
        text="Tu pago quedó registrado en ONVO; lo confirmamos en cuanto entrés."
        action={
          <Link href="/iniciar-sesion" className={buttonVariants({ variant: "solido" })}>
            Iniciar sesión
          </Link>
        }
      />
    );
  }
  if (confirm.error) {
    return (
      <Message
        icon={CircleX}
        title="No pudimos confirmar el pago"
        text={errorMessage(confirm.error)}
        action={backLink}
      />
    );
  }
  if (!confirm.data || status === "pending") {
    return (
      <Message
        icon={Clock}
        title="Confirmando tu pago…"
        text="Estamos verificando el pago con ONVO. No cerrés esta página."
      />
    );
  }
  if (status === "approved") {
    return (
      <Message
        icon={CircleCheck}
        title={`¡Listo! Ya tenés ${PAID_PLANS[confirm.data.plan].name}`}
        text={
          confirm.data.periodEnd
            ? `Tu plan está activo hasta el ${formatDate(confirm.data.periodEnd)}.`
            : undefined
        }
        action={backLink}
      />
    );
  }
  return (
    <Message
      icon={CircleX}
      title="El pago no se aprobó"
      text="No se hizo ningún cargo a tu plan. Podés intentarlo de nuevo con otra tarjeta."
      action={backLink}
    />
  );
}

function Message({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Clock;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Icon className="size-10 text-primary" strokeWidth={1.25} aria-hidden />
      <h1 className="font-display text-4xl leading-tight">{title}</h1>
      {text && <p className="text-muted-foreground">{text}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

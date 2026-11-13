import type { VaccineStatus } from "@vetify/types";
import { BadgeCheck } from "lucide-react";
import { StatusPill } from "@/components/system";
import type { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { STATUS_WORD, toneOf } from "@/lib/pet-summary";

export type PublicCard = Awaited<ReturnType<typeof api.verifyCard>>;

const checkedAtFormat = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Vence 20 nov 2026", "Venció 15 mar 2026"… */
function detail(v: PublicCard["vaccines"][number]): string {
  if (v.expiresOn)
    return `${v.status === "expired" ? "Venció" : "Vence"} ${formatDate(v.expiresOn)}`;
  if (v.lastAppliedOn) return `Aplicada ${formatDate(v.lastAppliedOn)}`;
  return "Sin aplicar";
}

/**
 * A verified card: the pet's name and the validity of its vaccines, nothing
 * else of the record. The public page and the clinic's scanner show it alike.
 */
export function PublicCardView({
  card,
  checkedAt,
  heading: Heading = "h2",
}: {
  card: PublicCard;
  checkedAt: Date | null;
  /** h1 on the public page, h2 inside the clinic portal. */
  heading?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col">
      <Heading className="font-display text-6xl leading-none font-medium break-words">
        {card.name}
      </Heading>
      <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-ok/12 px-3 py-1.5 text-sm font-medium text-ok">
        <BadgeCheck className="size-4" aria-hidden /> Carné verificado por Vetify
      </p>
      {checkedAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Consultado el {checkedAtFormat.format(checkedAt)}, con el expediente al día.
        </p>
      )}
      <section
        aria-label="Vacunas"
        className="mt-6 rounded-3xl bg-card px-5 py-2 shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.06)] dark:shadow-none dark:ring-1 dark:ring-border"
      >
        {card.vaccines.length === 0 ? (
          <p className="py-5 text-muted-foreground">
            Todavía no tiene vacunas registradas por una clínica.
          </p>
        ) : (
          <dl className="divide-y divide-border/70">
            {card.vaccines.map((v) => (
              <div
                key={v.vaccine}
                className="flex items-center justify-between gap-3 py-4"
              >
                <dt className="min-w-0">
                  <span className="block text-lg font-medium">{v.vaccine}</span>
                  <span className="block text-sm text-muted-foreground">{detail(v)}</span>
                </dt>
                <dd>
                  <StatusPill tone={toneOf[v.status as VaccineStatus]}>
                    {STATUS_WORD[v.status as VaccineStatus]}
                  </StatusPill>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

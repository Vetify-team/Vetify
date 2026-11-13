import type { Metadata } from "next";
import { GUIDES } from "@/components/landing/help-guides";
import { LandingShell, SectionHeading } from "@/components/landing/landing-shell";
import { LANDING_PAGES, siteHref } from "@/lib/sites";

export const metadata: Metadata = {
  title: "Ayuda",
  description: "Manuales de Vetify para dueños de mascotas y para clínicas veterinarias.",
  alternates: { canonical: LANDING_PAGES.help },
};

/** Index of the user manuals. */
export default function HelpPage() {
  return (
    <LandingShell>
      <section className="mx-auto flex max-w-4xl flex-col gap-10 px-5 pt-16 pb-24">
        <SectionHeading as="h1" label="Ayuda" title="Cómo usar Vetify" />
        <p className="max-w-2xl text-lg text-muted-foreground">
          Guías paso a paso, con capturas de la app real. Si te quedan dudas, escribinos.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <a
                href={siteHref("landing", `${LANDING_PAGES.help}/${guide.slug}`)}
                className="flex h-full flex-col gap-3 rounded-xl border border-border p-6 transition-colors hover:border-primary"
              >
                <span className="etiqueta">{guide.label}</span>
                <span className="font-display text-3xl leading-tight">{guide.title}</span>
                <span className="text-sm text-muted-foreground">
                  {guide.sections.map((s) => s.title).join(" · ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </LandingShell>
  );
}

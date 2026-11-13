import Image from "next/image";
import { LANDING_PAGES, siteHref } from "@/lib/sites";
import type { Guide } from "./help-guides";
import { LandingShell, SectionHeading } from "./landing-shell";

/** A user manual: numbered steps with screenshots, grouped in sections with an index. */
export function HelpGuide({ guide }: { guide: Guide }) {
  // Steps are numbered across the whole guide: where each section starts.
  const firstStep = guide.sections.map((_, i) =>
    guide.sections.slice(0, i).reduce((sum, s) => sum + s.steps.length, 1),
  );
  return (
    <LandingShell>
      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pt-16 pb-24">
        <header className="flex flex-col gap-5">
          <a
            href={siteHref("landing", LANDING_PAGES.help)}
            className="w-fit text-sm text-muted-foreground hover:text-primary"
          >
            ← Ayuda
          </a>
          <SectionHeading as="h1" label={guide.label} title={guide.title} />
          <p className="max-w-2xl text-lg text-muted-foreground">{guide.lede}</p>
        </header>

        <nav
          aria-label="Secciones del manual"
          className="sticky top-[65px] z-10 -mx-5 flex flex-wrap gap-x-5 gap-y-1 border-y border-border bg-background/95 px-5 py-3 text-sm backdrop-blur"
        >
          {guide.sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="hover:text-primary">
              {s.title}
            </a>
          ))}
        </nav>

        {guide.sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            id={section.id}
            className="flex scroll-mt-32 flex-col gap-3"
          >
            <h2 className="font-display text-4xl font-medium">{section.title}</h2>
            {section.intro && <p className="text-muted-foreground">{section.intro}</p>}
            <ol className="mt-2 flex flex-col border-t border-border">
              {section.steps.map((step, stepIndex) => {
                const n = firstStep[sectionIndex]! + stepIndex;
                return (
                  <li
                    key={step.title}
                    className="flex flex-col gap-4 border-b border-border py-7"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary font-display text-lg text-primary"
                      >
                        {n}
                      </span>
                      <h3 className="font-display text-2xl leading-tight">
                        {step.title}
                      </h3>
                    </div>
                    <div className="flex flex-col gap-4 sm:pl-13 [&_li]:ml-5 [&_li]:list-disc [&_p]:max-w-prose [&_ul]:mt-2 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
                      <div className="flex flex-col gap-3">{step.body}</div>
                      {step.tip && (
                        <p className="max-w-prose rounded-md bg-muted px-4 py-3 text-sm">
                          {step.tip}
                        </p>
                      )}
                      {step.images.map((image) => (
                        <figure key={image.src} className="flex flex-col gap-2">
                          <Image
                            src={image.src}
                            alt={image.alt}
                            width={image.width}
                            height={image.height}
                            sizes="(min-width: 768px) 672px, 100vw"
                            className="h-auto w-full rounded-lg border border-border"
                          />
                          <figcaption className="text-xs text-muted-foreground">
                            {image.alt}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </article>
    </LandingShell>
  );
}

import { buttonVariants } from "@/components/ui/button";
import { LANDING_PAGES, OWNER_PAGES, siteHref } from "@/lib/sites";
import { cn } from "@/lib/utils";

/** Where clinics ask for access. Public: it is printed on the clinic page. */
export const CONTACT_EMAIL = "contacto@vetify.live";

/** Header and footer of the landing site's pages (www). */
export function LandingShell({ children }: { children: React.ReactNode }) {
  const home = siteHref("landing", "/");
  // Same-page anchors on the home page, absolute links from the others.
  const section = (id: string) => `${home}#${id}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <nav
          className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4"
          aria-label="Principal"
        >
          <a href={home} className="font-display text-3xl leading-none font-medium">
            Vetify
          </a>
          <div className="ml-auto hidden items-center gap-6 text-sm sm:flex">
            <a href={section("duenos")} className="hover:text-primary">
              Para dueños
            </a>
            <a
              href={siteHref("landing", LANDING_PAGES.clinics)}
              className="hover:text-primary"
            >
              Para clínicas
            </a>
            <a href={section("planes")} className="hover:text-primary">
              Planes
            </a>
            <a
              href={siteHref("landing", LANDING_PAGES.help)}
              className="hover:text-primary"
            >
              Ayuda
            </a>
          </div>
          <a
            href={siteHref("owner", OWNER_PAGES.install)}
            className={cn(buttonVariants({ variant: "default" }), "ml-auto sm:ml-0")}
          >
            Instalar la app
          </a>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p className="font-display text-xl text-foreground">Vetify</p>
          <p className="sm:flex-1">
            Expediente clínico compartido de mascotas · Costa Rica
          </p>
          <a
            href={siteHref("landing", LANDING_PAGES.help)}
            className="hover:text-primary"
          >
            Ayuda
          </a>
          <a
            href={siteHref("landing", LANDING_PAGES.terms)}
            className="hover:text-primary"
          >
            Términos
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-primary">
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

/** Heading of a landing section: small label over a display title. */
export function SectionHeading({
  label,
  title,
  as: Tag = "h2",
}: {
  label: string;
  title: string;
  as?: "h1" | "h2";
}) {
  return (
    <div>
      <p className="etiqueta">{label}</p>
      <Tag className="mt-2 max-w-2xl font-display text-5xl leading-[1.02] font-medium text-balance">
        {title}
      </Tag>
    </div>
  );
}

/** A numbered step: big serif number, title and explanation. */
export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-5 py-5">
      <span
        className="w-8 shrink-0 font-display text-4xl leading-none text-primary"
        aria-hidden
      >
        {n}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-2xl leading-tight">{title}</span>
        {children && <span className="text-sm text-muted-foreground">{children}</span>}
      </span>
    </li>
  );
}

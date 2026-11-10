import { Bell, EllipsisVertical, Share, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { LandingShell, SectionHeading, Step } from "@/components/landing/landing-shell";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteHref } from "@/lib/sites";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Instalá la app",
  description:
    "Instalá Vetify en tu iPhone o Android en menos de un minuto, directo desde el navegador y sin tiendas de aplicaciones.",
  alternates: { canonical: "/instalar" },
};

/**
 * How to install the owner app (a PWA) on iPhone and Android. The app lives
 * on its own host, so it can only be installed from there: this page sends
 * the visitor to it and explains the browser's own install steps. The tab of
 * the visitor's system opens first.
 */
export default async function InstallPage() {
  const request = await headers();
  const userAgent = request.get("user-agent") ?? "";
  const system = /android/i.test(userAgent) ? "android" : "ios";
  const appUrl = siteHref("owner", "/");
  const appHost = displayHost(appUrl);
  // Desktop visitors scan it to open the app on their phone.
  // Without per-site URLs (local, previews) the app is on this same host.
  const qrTarget = appUrl.startsWith("http")
    ? appUrl
    : `${request.get("x-forwarded-proto") ?? "http"}://${request.get("host")}${appUrl}`;
  const qr = await QRCode.toDataURL(qrTarget, { width: 360, margin: 1 });

  const openApp = (
    <a
      href={appUrl}
      className={cn(buttonVariants({ variant: "solido" }), "h-11 self-start px-5")}
    >
      Abrir {appHost}
    </a>
  );

  return (
    <LandingShell>
      <section className="mx-auto grid max-w-6xl gap-14 px-5 pt-16 pb-20 md:grid-cols-[1.4fr_1fr] md:pt-20">
        <div className="flex flex-col">
          <SectionHeading
            as="h1"
            label="Para dueños"
            title="Instalá Vetify en tu teléfono"
          />
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Vetify se instala directo desde el navegador: no hace falta la App Store ni
            Google Play. Queda con su ícono en la pantalla de inicio y abre como cualquier
            otra app.
          </p>

          <Tabs defaultValue={system} className="mt-10">
            <TabsList>
              <TabsTrigger value="ios" className="px-4">
                iPhone
              </TabsTrigger>
              <TabsTrigger value="android" className="px-4">
                Android
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ios">
              <ol className="flex flex-col divide-y divide-border border-y border-border">
                <Step n={1} title="Abrí la app en Safari">
                  Tocá el botón de abajo desde tu iPhone. Si usás otro navegador, copiá el
                  enlace {appHost} y pegalo en Safari.
                </Step>
                <Step
                  n={2}
                  title={
                    <>
                      Tocá Compartir{" "}
                      <Share
                        className="inline size-5 align-[-2px] text-primary"
                        aria-hidden
                      />
                    </>
                  }
                >
                  Es el cuadrado con una flecha hacia arriba. En iOS 26 está dentro del
                  menú &ldquo;···&rdquo; de la barra de Safari.
                </Step>
                <Step n={3} title="Elegí “Agregar a inicio”">
                  En versiones anteriores dice &ldquo;Agregar a pantalla de inicio&rdquo;.
                  Si no lo ves, deslizá la lista hacia abajo.
                </Step>
                <Step n={4} title="Tocá “Agregar”">
                  Si aparece la opción &ldquo;Abrir como app web&rdquo;, dejala activada.
                </Step>
                <Step n={5} title="Abrí Vetify desde el ícono">
                  Creá tu cuenta o iniciá sesión desde la app instalada.
                </Step>
              </ol>
              <div className="mt-6 flex flex-col gap-4">{openApp}</div>
            </TabsContent>

            <TabsContent value="android">
              <ol className="flex flex-col divide-y divide-border border-y border-border">
                <Step n={1} title="Abrí Vetify desde tu teléfono">
                  Tocá el botón de abajo. Funciona en Chrome, Samsung Internet y Edge.
                </Step>
                <Step n={2} title="Tocá “Instalar Vetify”">
                  Aparece en la pantalla de bienvenida de la app.
                </Step>
                <Step n={3} title="Confirmá con “Instalar”">
                  Listo: Vetify queda con su ícono en tu pantalla de inicio.
                </Step>
              </ol>
              <div className="mt-6 flex flex-col gap-4">{openApp}</div>
              <p className="mt-4 text-sm text-muted-foreground">
                ¿No ves el botón? Abrí el menú{" "}
                <EllipsisVertical
                  className="inline size-4 align-[-2px] text-primary"
                  aria-hidden
                />{" "}
                del navegador y elegí &ldquo;Instalar app&rdquo; o &ldquo;Agregar a la
                pantalla principal&rdquo;.
              </p>
            </TabsContent>
          </Tabs>

          <p className="mt-8 flex gap-3 text-sm text-muted-foreground">
            <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            En iPhone, los avisos de vacunas solo llegan con la app instalada (iOS 16.4 o
            posterior). Activalos desde Ajustes dentro de Vetify.
          </p>
        </div>

        <aside className="flex flex-col items-center gap-5 self-start rounded-2xl border border-border bg-card p-8 text-center">
          <Smartphone className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
          <p className="font-display text-2xl leading-tight">¿Estás en la computadora?</p>
          {/* A data URL built here from our own URL; the CSP allows data: images. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`Código QR para abrir ${appHost}`}
            width={180}
            height={180}
            className="rounded-lg bg-white p-2"
          />
          <p className="text-sm text-muted-foreground">
            Escaneá el código con la cámara de tu teléfono y seguí los pasos.
          </p>
          <a href={appUrl} className="text-sm text-primary underline underline-offset-4">
            Instalarla en esta computadora
          </a>
        </aside>
      </section>
    </LandingShell>
  );
}

/** "app.vetify.live" from the app's URL; "Vetify" when it has no host of its own. */
function displayHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "Vetify";
  }
}

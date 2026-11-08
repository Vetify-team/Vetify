import { TERMS_VERSION } from "@vetify/types";
import type { Metadata } from "next";
import {
  CONTACT_EMAIL,
  LandingShell,
  SectionHeading,
} from "@/components/landing/landing-shell";
import { FREE_PLAN_LIMIT } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones de uso de Vetify: cuentas, expediente clínico, permisos de clínicas, pagos y protección de datos personales.",
  alternates: { canonical: "/terminos" },
};

/** The version new accounts accept (and the API records): bump it with the text. */
const UPDATED = new Date(`${TERMS_VERSION}T12:00:00`).toLocaleDateString("es-CR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const mail = (
  <a
    href={`mailto:${CONTACT_EMAIL}`}
    className="text-primary underline underline-offset-4"
  >
    {CONTACT_EMAIL}
  </a>
);

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "servicio",
    title: "Qué es Vetify",
    body: (
      <>
        <p>
          Vetify es una aplicación web para llevar el expediente clínico y el carné de
          vacunación de las mascotas. Los dueños guardan la información de sus mascotas y
          las clínicas veterinarias consultan y registran actos médicos en ese mismo
          expediente, solo con el permiso del dueño.
        </p>
        <p>
          Al crear una cuenta o usar Vetify aceptás estos términos. Si no estás de
          acuerdo, no uses el servicio.
        </p>
      </>
    ),
  },
  {
    id: "cuentas",
    title: "Tu cuenta",
    body: (
      <ul>
        <li>Tenés que ser mayor de edad y dar datos verdaderos.</li>
        <li>
          La cuenta es personal. Cuidá tu contraseña: sos responsable de lo que se haga
          con tu cuenta. Si creés que alguien más la usa, cambiá la contraseña y
          escribinos.
        </li>
        <li>
          Si olvidás la contraseña, podés recuperarla con un enlace que enviamos a tu
          correo. El enlace vence y sirve una sola vez.
        </li>
      </ul>
    ),
  },
  {
    id: "duenos",
    title: "El expediente pertenece al dueño",
    body: (
      <ul>
        <li>
          La información de tus mascotas es tuya. Vos decidís qué clínica puede verla o
          registrar en ella, y podés quitar ese permiso cuando quieras.
        </li>
        <li>
          Cuando quitás un permiso, la clínica deja de ver el expediente. Lo que ya
          registró queda en el expediente de tu mascota, porque es parte de su historia
          clínica.
        </li>
        <li>
          Si activás el enlace público del carné, cualquier persona con ese enlace o su
          código QR puede ver el carné de vacunación. Podés desactivarlo en cualquier
          momento.
        </li>
      </ul>
    ),
  },
  {
    id: "clinicas",
    title: "Clínicas veterinarias",
    body: (
      <ul>
        <li>
          Las clínicas obtienen acceso a través de un administrador de Vetify, que
          verifica sus datos antes de habilitarlas.
        </li>
        <li>
          Una clínica solo puede ver y registrar en el expediente de las mascotas cuyos
          dueños le dieron permiso. Cada acceso queda registrado y el dueño puede
          consultarlo.
        </li>
        <li>
          La clínica y sus veterinarios son responsables de lo que registran y de su
          ejercicio profesional. Solo pueden usar la información para atender a la
          mascota.
        </li>
      </ul>
    ),
  },
  {
    id: "salud",
    title: "La información no reemplaza al veterinario",
    body: (
      <p>
        Los recordatorios de vacunas y desparasitaciones se calculan con el esquema de
        vacunación de Costa Rica y con lo que se registró en el expediente. Son una ayuda,
        no un diagnóstico ni una indicación médica. Ante cualquier duda sobre la salud de
        tu mascota, consultá a un médico veterinario. Vetify no garantiza que los datos
        que registran los dueños o las clínicas estén completos o sean correctos.
      </p>
    ),
  },
  {
    id: "planes",
    title: "Planes y pagos",
    body: (
      <ul>
        <li>
          El plan gratuito para dueños incluye el expediente, el carné digital y
          recordatorios para hasta {FREE_PLAN_LIMIT} mascotas.
        </li>
        <li>
          Los planes pagos se cobran en colones costarricenses. Cada pago activa el plan
          por 30 días y no se renueva solo: para seguir, pagás otro período.
        </li>
        <li>
          Los pagos se procesan en Tilopay. Vetify no ve ni guarda los datos de tu
          tarjeta.
        </li>
        <li>
          Si un cobro fue un error o querés ejercer tu derecho de retracto según la Ley de
          Promoción de la Competencia y Defensa Efectiva del Consumidor (Ley 7472),
          escribinos a {mail} indicando el número de orden.
        </li>
        <li>
          Podemos cambiar los precios. Si lo hacemos, te avisamos antes y el cambio no
          afecta un período que ya pagaste.
        </li>
      </ul>
    ),
  },
  {
    id: "datos",
    title: "Tus datos personales",
    body: (
      <>
        <p>
          Tratamos tus datos según la Ley de Protección de la Persona frente al
          Tratamiento de sus Datos Personales (Ley 8968) de Costa Rica.
        </p>
        <ul>
          <li>
            <strong>Qué guardamos:</strong> tu nombre, correo y teléfono; los datos de tus
            mascotas y su expediente clínico; los permisos que das; el registro de accesos
            de las clínicas; y los datos técnicos necesarios para mantener tu sesión
            segura.
          </li>
          <li>
            <strong>Para qué:</strong> para prestar el servicio, enviarte avisos y correos
            de la cuenta (como recordatorios o recuperación de contraseña), procesar pagos
            y proteger la plataforma. No vendemos tus datos ni los usamos para publicidad
            de terceros.
          </li>
          <li>
            <strong>Con quién:</strong> con las clínicas que vos autorizás, y con los
            proveedores que operan Vetify por nosotros: alojamiento y base de datos
            (Vercel, Render y Neon), correo (Resend y Zoho), pagos (Tilopay) y monitoreo
            técnico (Grafana). Algunos de ellos guardan la información fuera de Costa
            Rica, principalmente en los Estados Unidos.
          </li>
          <li>
            <strong>Tus derechos:</strong> podés pedir acceso a tus datos, que los
            corrijamos o que eliminemos tu cuenta escribiendo a {mail}. Algunos registros
            pueden conservarse por el tiempo que exija la ley o para resolver disputas.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "uso",
    title: "Uso permitido",
    body: (
      <>
        <p>No podés:</p>
        <ul>
          <li>entrar a cuentas o expedientes que no te corresponden;</li>
          <li>hacerte pasar por otra persona o por una clínica;</li>
          <li>registrar información falsa o contenido ilegal;</li>
          <li>
            intentar dañar el servicio, saltarte sus controles de seguridad o usarlo de
            forma automatizada sin permiso.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "disponibilidad",
    title: "Disponibilidad y responsabilidad",
    body: (
      <p>
        Trabajamos para que Vetify esté disponible y tus datos estén seguros, pero el
        servicio puede interrumpirse por mantenimiento o por fallas de terceros. En la
        medida que la ley lo permite, Vetify no responde por daños indirectos ni por
        decisiones tomadas solo con base en la información de la aplicación.
      </p>
    ),
  },
  {
    id: "cierre",
    title: "Suspensión y cierre de la cuenta",
    body: (
      <p>
        Podés dejar de usar Vetify cuando quieras y pedirnos que eliminemos tu cuenta.
        Podemos suspender o cerrar una cuenta que incumpla estos términos o ponga en
        riesgo a otras personas, y te avisaremos cuando sea posible.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    body: (
      <p>
        Si cambiamos estos términos, publicamos la nueva versión en esta página con su
        fecha. Si el cambio es importante, te avisamos por correo o dentro de la
        aplicación antes de que aplique.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable y contacto",
    body: (
      <p>
        Estos términos se rigen por las leyes de la República de Costa Rica. Para
        cualquier consulta, reclamo o solicitud sobre tus datos, escribinos a {mail}.
      </p>
    ),
  },
];

/** Terms of use and privacy, on the landing site (www). */
export default function TermsPage() {
  return (
    <LandingShell>
      <article className="mx-auto max-w-3xl px-5 pt-16 pb-24 md:pt-20">
        <SectionHeading as="h1" label="Legal" title="Términos y condiciones" />
        <p className="mt-4 text-sm text-muted-foreground">
          Última actualización: {UPDATED}
        </p>

        <nav aria-label="Contenido" className="mt-10 border-y border-border py-5">
          <ol className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {SECTIONS.map((section, i) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:text-primary">
                  {i + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 flex flex-col gap-12">
          {SECTIONS.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-display text-3xl leading-tight">
                {i + 1}. {section.title}
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-muted-foreground [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </LandingShell>
  );
}

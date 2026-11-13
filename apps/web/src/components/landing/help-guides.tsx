import type { ReactNode } from "react";

/** A screenshot of the real app, served from /public/ayuda. */
export interface GuideImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface GuideStep {
  title: string;
  body: ReactNode;
  tip?: string;
  images: GuideImage[];
}

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  steps: GuideStep[];
}

export interface Guide {
  slug: "duenos" | "clinicas";
  label: string;
  title: string;
  lede: string;
  sections: GuideSection[];
}

const img = (name: string, alt: string, width: number, height: number): GuideImage => ({
  src: `/ayuda/${name}.jpg`,
  alt,
  width,
  height,
});

/** The owner manual, checked against staging on 11-12 Nov 2026. */
export const OWNER_GUIDE: Guide = {
  slug: "duenos",
  label: "Para dueños",
  title: "Manual de Vetify para dueños",
  lede: "Cómo llevar el expediente de tu mascota en Vetify: crear la cuenta, cargar exámenes y peso, y compartirlo con tu veterinaria. Las capturas son de la app real, con datos de prueba.",
  sections: [
    {
      id: "cuenta",
      title: "Crear la cuenta",
      intro:
        "Entrá a app.vetify.live desde el teléfono o la computadora. Te toma unos dos minutos.",
      steps: [
        {
          title: "Empezá el registro",
          body: (
            <>
              <p>
                Tocá <strong>Crear mi cuenta</strong>. Si ya tenés cuenta, tocá{" "}
                <strong>Ya tengo cuenta</strong>.
              </p>
            </>
          ),
          images: [img("d01-inicio", "Pantalla de inicio de app.vetify.live.", 800, 871)],
        },
        {
          title: "Tus datos para entrar",
          body: (
            <>
              <p>
                Escribí tu nombre y después tu correo, un teléfono (opcional) y una
                contraseña de al menos 12 caracteres. Marcá que aceptás los términos y
                tocá <strong>Crear mi cuenta</strong>.
              </p>
            </>
          ),
          tip: "Te llega un correo de bienvenida. Si el correo ya tiene una cuenta, la app te lo avisa: iniciá sesión con él.",
          images: [img("d02-datos", "Correo, teléfono y contraseña.", 800, 871)],
        },
      ],
    },
    {
      id: "mascota",
      title: "Registrar tu mascota",
      steps: [
        {
          title: "Elegí la especie",
          body: (
            <>
              <p>
                Perro, gato u otra. Si preferís hacerlo después, tocá{" "}
                <strong>Registrar mi mascota después</strong>.
              </p>
            </>
          ),
          images: [img("d03-especie", "Elegir la especie.", 800, 871)],
        },
        {
          title: "Nombre, sexo, nacimiento y esterilización",
          body: (
            <>
              <p>
                Con la fecha de nacimiento Vetify calcula qué vacunas le tocan y cuándo
                vencen. Raza, microchip y foto los agregás después desde el perfil.
              </p>
            </>
          ),
          images: [img("d04-mascota", "Datos básicos de la mascota.", 800, 871)],
        },
        {
          title: "El expediente queda listo",
          body: (
            <>
              <p>
                Se crean el expediente, el esquema de vacunas y el carné digital. El
                expediente empieza vacío: se llena con lo que cargás vos y lo que registra
                tu veterinaria.
              </p>
            </>
          ),
          images: [
            img("d05-expediente-listo", "Expediente, esquema y carné creados.", 800, 871),
          ],
        },
        {
          title: "Elegí el plan",
          body: (
            <>
              <p>
                El plan <strong>Gratuito</strong> incluye el expediente completo, el carné
                con QR, los recordatorios y hasta 2 mascotas.
              </p>
            </>
          ),
          images: [img("d06-plan", "Planes disponibles.", 800, 871)],
        },
        {
          title: "Tus mascotas",
          body: (
            <>
              <p>
                Desde <strong>Mis mascotas</strong> abrís el perfil de cada una, el carné
                y el registro de peso. El botón <strong>+</strong> agrega otra mascota.
              </p>
            </>
          ),
          images: [img("d07-mis-mascotas", "Lista de mascotas.", 800, 871)],
        },
      ],
    },
    {
      id: "perfil",
      title: "Perfil y foto",
      steps: [
        {
          title: "Agregá una foto",
          body: (
            <>
              <p>
                En el perfil tocá <strong>Agregar foto</strong> y elegí una imagen JPG,
                PNG, WEBP o HEIC de hasta 5 MB. Podés cambiarla o quitarla cuando quieras.
              </p>
              <p>
                Desde el perfil también entrás al historial, al esquema de vacunas, al
                peso, al carné y a <strong>Quién puede verlo</strong>.
              </p>
            </>
          ),
          images: [img("d08-perfil-foto", "Perfil con la foto cargada.", 800, 871)],
        },
      ],
    },
    {
      id: "examenes",
      title: "Cargar exámenes",
      intro:
        "Si te hicieron un examen en un laboratorio externo, cargalo vos. Queda en el expediente marcado como cargado por el dueño.",
      steps: [
        {
          title: "Abrí el expediente y tocá Agregar examen",
          body: (
            <>
              <p>
                Escribí el tipo (por ejemplo, hemograma), la fecha y un resumen del
                resultado. Adjuntá el archivo: PDF, JPG, PNG, WEBP o HEIC de hasta 10 MB.
              </p>
            </>
          ),
          images: [img("d09-agregar-examen", "Formulario de examen.", 800, 871)],
        },
        {
          title: "Esperá a que diga Archivo listo",
          body: (
            <>
              <p>
                El archivo se sube apenas lo elegís. Cuando aparece{" "}
                <strong>Archivo listo</strong>, tocá <strong>Guardar examen</strong>.
              </p>
            </>
          ),
          images: [img("d10-examen-listo", "El PDF ya subido.", 800, 871)],
        },
        {
          title: "El examen aparece en el historial",
          body: (
            <>
              <p>
                Con <strong>Ver archivo (PDF)</strong> lo abrís. El enlace dura 5 minutos:
                si pasa más tiempo, tocá de nuevo para generar otro.
              </p>
            </>
          ),
          images: [
            img("d11-expediente-examen", "Historial con el examen cargado.", 800, 871),
          ],
        },
      ],
    },
    {
      id: "observaciones",
      title: "Observaciones y peso",
      steps: [
        {
          title: "Anotá lo que notás",
          body: (
            <>
              <p>
                Al final del expediente, en <strong>Anotar una observación</strong>,
                escribí cambios de alimentación, comportamiento o síntomas, con su fecha.
                Tu veterinaria lo ve si le compartiste el expediente.
              </p>
            </>
          ),
          images: [
            img("d12-observacion", "Observación guardada en el historial.", 800, 871),
          ],
        },
        {
          title: "Registrá el peso",
          body: (
            <>
              <p>
                En <strong>Serie de peso</strong> escribí los kilos y la fecha. Con dos
                registros o más aparece la gráfica.
              </p>
            </>
          ),
          tip: "Si el peso cambia 10 % o más entre dos registros con 90 días o menos de diferencia, Vetify te avisa en Avisos y por correo.",
          images: [img("d13-peso", "Gráfica con dos registros de peso.", 800, 871)],
        },
      ],
    },
    {
      id: "compartir",
      title: "Compartir con tu veterinaria",
      intro:
        "La clínica solo ve el expediente si vos se lo compartís, y podés quitarle el acceso cuando quieras.",
      steps: [
        {
          title: "Pedile el código a la clínica",
          body: (
            <>
              <p>
                En la consulta, la clínica te muestra un código de vinculación de 8 letras
                y números (por ejemplo, <code>HDHK-U2VW</code>). Sirve una vez y dura 10
                minutos.
              </p>
              <p>
                En el perfil de tu mascota entrá a <strong>Quién puede verlo</strong>,
                escribí el código y tocá <strong>Buscar clínica</strong>.
              </p>
            </>
          ),
          images: [],
        },
        {
          title: "Confirmá la clínica y qué puede hacer",
          body: (
            <>
              <p>
                Vetify te muestra el nombre de la clínica con el sello de verificada.
                Elegí el permiso:
              </p>
              <ul>
                <li>
                  <strong>Puede ver y escribir</strong>: ve el expediente y registra
                  consultas, vacunas, desparasitaciones, tratamientos y exámenes.
                </li>
                <li>
                  <strong>Solo carné verificable</strong>: solo la vigencia de las
                  vacunas.
                </li>
              </ul>
              <p>
                Tocá <strong>Dar acceso</strong>.
              </p>
            </>
          ),
          images: [img("d14-dar-acceso", "Confirmar la clínica y el permiso.", 800, 871)],
        },
        {
          title: "Revisá quién tiene acceso",
          body: (
            <>
              <p>
                Cada clínica aparece con su permiso. El interruptor le quita o le devuelve
                el acceso al instante.
              </p>
            </>
          ),
          images: [img("d15-con-acceso", "Clínicas con acceso.", 800, 871)],
        },
        {
          title: "La bitácora",
          body: (
            <>
              <p>
                Cada vez que una clínica abre o escribe en el expediente queda registrado:
                qué hizo, quién y cuándo. Con <strong>Incluir lo mío</strong> ves también
                tus propias acciones.
              </p>
            </>
          ),
          images: [img("d16-bitacora", "Bitácora de accesos.", 800, 871)],
        },
      ],
    },
    {
      id: "clinica",
      title: "Lo que registra la clínica",
      steps: [
        {
          title: "Todo en una sola historia",
          body: (
            <>
              <p>
                Las consultas, vacunas y exámenes que registra la clínica aparecen en tu
                expediente con el nombre del veterinario y de la clínica, junto con lo que
                cargaste vos.
              </p>
            </>
          ),
          images: [
            img(
              "d17-historial-clinica",
              "Historial con registros de la clínica y del dueño.",
              800,
              871,
            ),
          ],
        },
        {
          title: "El carné de vacunación",
          body: (
            <>
              <p>
                El carné muestra solo las vacunas aplicadas y hasta cuándo están vigentes.
                Con <strong>Crear QR</strong> generás un código para que un hospedaje, una
                guardería o una aerolínea confirme la vigencia sin ver el resto del
                expediente.
              </p>
            </>
          ),
          images: [img("d18-carne", "Carné con la vacuna de rabia vigente.", 800, 871)],
        },
      ],
    },
    {
      id: "asistente",
      title: "Preguntale a Vetify",
      intro:
        "Un asistente que responde con el expediente de tu mascota: vacunas, peso, comida y cuidados.",
      steps: [
        {
          title: "Abrí el asistente",
          body: (
            <>
              <p>
                En el perfil de tu mascota, tocá <strong>Preguntale a Vetify</strong>.
                Escribí tu pregunta o usá un acceso rápido, como{" "}
                <strong>¿Le toca alguna vacuna?</strong>. Enter envía; Mayús+Enter agrega
                una línea.
              </p>
              <p>
                Responde solo con lo que está en el expediente: si algo no está
                registrado, te lo dice. No da dosis de medicamentos ni reemplaza a tu
                veterinaria; si describís una emergencia, te indica ir de inmediato.
              </p>
            </>
          ),
          tip: "La conversación no se guarda: se borra al cerrar la app o con Nueva conversación. En el plan gratuito tenés un número de mensajes por mes; lo ves debajo del título.",
          images: [
            img(
              "d19-asistente",
              "Chat del asistente respondiendo qué vacunas le tocan a la mascota.",
              800,
              1731,
            ),
          ],
        },
      ],
    },
  ],
};

/** The clinic manual, checked against staging on 11-12 Nov 2026. */
export const CLINIC_GUIDE: Guide = {
  slug: "clinicas",
  label: "Para clínicas",
  title: "Manual de Vetify para clínicas",
  lede: "Cómo usa una clínica veterinaria el portal de Vetify: registrarse con el enlace, armar el equipo, vincular pacientes y registrar consultas, vacunas y exámenes. Las capturas son de la app real, con datos de prueba.",
  sections: [
    {
      id: "alta",
      title: "Alta de la clínica",
      intro:
        "El acceso lo habilita Vetify. Cuando la clínica acuerda su plan, recibe por correo un enlace de registro que sirve una vez y vence en 7 días.",
      steps: [
        {
          title: "Abrí el enlace del correo",
          body: (
            <>
              <p>
                En el correo <em>Registrá … en Vetify</em> tocá{" "}
                <strong>Registrar la clínica</strong>. Se abre el registro con el nombre
                de tu clínica.
              </p>
            </>
          ),
          images: [],
        },
        {
          title: "Tus datos y los de la clínica",
          body: (
            <>
              <p>
                Escribí el nombre de la persona responsable, el teléfono y una contraseña.
                El correo viene fijo desde el enlace. Quien se registra queda como
                administrador de la clínica.
              </p>
            </>
          ),
          images: [
            img("c01-datos-clinica", "Datos de la clínica y del acceso.", 800, 871),
          ],
        },
        {
          title: "La clínica queda en revisión",
          body: (
            <>
              <p>
                Vetify revisa cada clínica antes de que pueda recibir expedientes, para
                que nadie se haga pasar por otra. Mientras tanto podés entrar al portal,
                ver tu plan e invitar a tu equipo.
              </p>
            </>
          ),
          images: [
            img("c02-en-revision", "Clínica en revisión.", 800, 871),
            img(
              "c07-codigo-bloqueado",
              "Sin verificar, el portal no genera códigos de vinculación.",
              800,
              871,
            ),
          ],
        },
        {
          title: "Tu plan",
          body: (
            <>
              <p>
                El plan acordado queda activo 30 días desde el registro. Lo renovás o
                cambiás desde <strong>Plan</strong>; el pago se procesa en ONVO.
              </p>
            </>
          ),
          images: [
            img(
              "c03-plan-consultorio",
              "Plan Consultorio al terminar el registro.",
              800,
              871,
            ),
            img("c06-plan", "La sección Plan del portal.", 800, 871),
          ],
        },
        {
          title: "Verificación",
          body: (
            <>
              <p>
                Cuando Vetify confirma la cédula jurídica y que la persona responsable
                está colegiada, verifica la clínica. Te llega un correo y desde ese
                momento podés generar códigos.
              </p>
            </>
          ),
          images: [
            img(
              "a03-verificadas",
              "Del lado de Vetify: la clínica verificada, con la fecha y quién la verificó.",
              800,
              871,
            ),
          ],
        },
      ],
    },
    {
      id: "equipo",
      title: "Tu equipo",
      intro:
        "Cada veterinario entra con su propia cuenta y lo que registra queda firmado con su nombre. Solo los administradores ven la sección Equipo.",
      steps: [
        {
          title: "Invitá a tus veterinarios",
          body: (
            <>
              <p>
                En <strong>Equipo</strong> escribí el correo, elegí el rol y tocá{" "}
                <strong>Enviar invitación</strong>.
              </p>
              <ul>
                <li>
                  <strong>Veterinario</strong>: atiende pacientes.
                </li>
                <li>
                  <strong>Administrador</strong>: además maneja el equipo.
                </li>
              </ul>
            </>
          ),
          tip: "El correo no puede tener ya una cuenta en Vetify. La invitación vence en 7 días y se puede anular mientras esté pendiente.",
          images: [
            img("c04-equipo", "Equipo con el administrador.", 800, 871),
            img("c05-invitaciones", "Dos invitaciones pendientes.", 800, 871),
          ],
        },
        {
          title: "El veterinario acepta la invitación",
          body: (
            <>
              <p>
                Le llega el correo <em>Te invitaron al equipo de … en Vetify</em>. Con{" "}
                <strong>Aceptar la invitación</strong> crea su cuenta con ese correo y
                entra directo al portal de la clínica.
              </p>
              <p>
                Cuando acepta, aparece en <strong>Miembros</strong> con su rol. Con{" "}
                <strong>Quitar</strong> pierde el acceso al instante; lo que firmó sigue
                firmado.
              </p>
            </>
          ),
          tip: "Un veterinario no ve la sección Equipo: solo los administradores invitan o quitan gente.",
          images: [
            img(
              "c17-aceptar-invitacion",
              "La invitación abierta: nombre, contraseña y términos.",
              800,
              871,
            ),
            img(
              "c16-equipo-completo",
              "Equipo con el administrador y los veterinarios.",
              800,
              871,
            ),
          ],
        },
      ],
    },
    {
      id: "pacientes",
      title: "Vincular pacientes",
      intro:
        "La clínica no busca mascotas: el dueño le da acceso con un código que la clínica le muestra en la consulta.",
      steps: [
        {
          title: "Generá el código",
          body: (
            <>
              <p>
                En <strong>Código de vinculación</strong> tocá{" "}
                <strong>Generar código</strong> y mostráselo al dueño. Dura 10 minutos y
                sirve una vez.
              </p>
            </>
          ),
          images: [img("c08-codigo", "Código de vinculación.", 800, 871)],
        },
        {
          title: "El paciente aparece en tu lista",
          body: (
            <>
              <p>
                Cuando el dueño escribe el código en su app y te da permiso de ver y
                escribir, la mascota aparece en <strong>Pacientes</strong>.
              </p>
            </>
          ),
          tip: "Si el dueño te dio solo el carné verificable, la mascota no aparece en Pacientes: la encontrás en Carnés.",
          images: [img("c09-pacientes", "Lista de pacientes.", 800, 871)],
        },
        {
          title: "El expediente compartido",
          body: (
            <>
              <p>
                Ves todo el historial: lo que registraron las clínicas y lo que cargó el
                dueño (exámenes externos, observaciones y peso), además del esquema de
                vacunas.
              </p>
            </>
          ),
          images: [
            img("c10-paciente", "Expediente de un paciente recién vinculado.", 800, 871),
          ],
        },
        {
          title: "Carnés",
          body: (
            <>
              <p>
                En <strong>Carnés</strong> ves la vigencia de las vacunas de cada
                paciente. Las mascotas que te compartieron solo el carné aparecen con la
                etiqueta <strong>Solo carné</strong>: es lo único que ves de ellas. Las
                demás enlazan a su expediente.
              </p>
            </>
          ),
          images: [img("c20-carnes", "Carnés, con un paciente de solo carné.", 800, 871)],
        },
      ],
    },
    {
      id: "registros",
      title: "Registrar en el expediente",
      intro:
        "Cada registro queda a nombre del veterinario y de la clínica, y el dueño lo ve en su app.",
      steps: [
        {
          title: "Consulta",
          body: (
            <>
              <p>
                Tocá <strong>Registrar consulta</strong> y completá el motivo, el
                diagnóstico y las notas.
              </p>
            </>
          ),
          images: [img("c11-consulta", "Formulario de consulta.", 800, 871)],
        },
        {
          title: "Vacuna",
          body: (
            <>
              <p>
                Tocá <strong>Aplicar vacuna</strong>, elegí la vacuna del esquema, el lote
                y la fecha. Si no indicás el vencimiento, Vetify lo calcula con el esquema
                de Costa Rica.
              </p>
            </>
          ),
          images: [img("c12-vacuna", "Formulario de vacuna.", 800, 871)],
        },
        {
          title: "Examen con archivo",
          body: (
            <>
              <p>
                Tocá <strong>Examen</strong>, escribí el tipo, la fecha y el resultado, y
                adjuntá el PDF o la imagen (hasta 10 MB). Esperá a que diga{" "}
                <strong>Archivo listo</strong> antes de guardar.
              </p>
            </>
          ),
          images: [img("c13-examen", "Ecografía con el PDF adjunto.", 800, 871)],
        },
        {
          title: "Desparasitación",
          body: (
            <>
              <p>
                Tocá <strong>Desparasitación</strong>, escribí el producto, elegí interna
                o externa, la fecha y la próxima dosis. El dueño recibe un aviso cuando se
                acerca esa fecha.
              </p>
            </>
          ),
          images: [
            img("c18-desparasitacion", "Formulario de desparasitación.", 800, 871),
          ],
        },
        {
          title: "El historial firmado",
          body: (
            <>
              <p>
                Cada registro muestra quién lo hizo y en qué clínica: acá, la
                desparasitación quedó firmada por la Dra. María Marín y el resto por el
                Dr. Andrés Trompeta. Los exámenes con archivo tienen{" "}
                <strong>Ver archivo</strong>; el enlace dura 5 minutos.
              </p>
            </>
          ),
          images: [
            img(
              "c19-firma-veterinaria",
              "Historial con actos firmados por dos veterinarios de la misma clínica.",
              800,
              871,
            ),
          ],
        },
      ],
    },
    {
      id: "asistente",
      title: "Asistente clínico",
      intro:
        "Apoyo para preparar la consulta con el expediente del paciente. La decisión clínica es siempre del veterinario.",
      steps: [
        {
          title: "Abrí el asistente desde la ficha",
          body: (
            <>
              <p>
                En la ficha del paciente, tocá <strong>Asistente</strong>. Se abre un
                panel al costado (en el teléfono, a pantalla completa) con accesos
                rápidos: <strong>Resumen pre-consulta</strong>, vacunas vencidas o por
                vencer, <strong>Tendencia de peso</strong> y{" "}
                <strong>Redactar indicaciones para el dueño</strong>, que trae un botón{" "}
                <strong>Copiar</strong>.
              </p>
              <p>
                Lo usa cualquier miembro del equipo, administrador o veterinario, mientras
                la clínica esté verificada y tenga permiso sobre el paciente. Cada uso
                queda en la bitácora que ve el dueño.
              </p>
            </>
          ),
          tip: "El resumen puede decir quién firmó cada vacuna. Revisá siempre lo que copiás antes de entregárselo al dueño.",
          images: [
            img(
              "c20-asistente",
              "Panel del asistente clínico con el resumen pre-consulta de un paciente.",
              800,
              500,
            ),
          ],
        },
      ],
    },
  ],
};

export const GUIDES = [OWNER_GUIDE, CLINIC_GUIDE];

import { ErrorDeApi } from "./api-client";

/**
 * Lo único que se necesita de un esquema Zod de @vetify/types. Se declara acá
 * para no depender de `zod` directamente desde la web.
 */
interface Esquema<T> {
  safeParse(
    valor: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

export type ErroresDeCampo = Record<string, string>;

/**
 * Lee un <form> y lo valida con el mismo esquema Zod que usa el API. Los
 * campos vacíos se omiten para que los opcionales queden `undefined`.
 */
export function validarFormulario<T>(
  formulario: HTMLFormElement,
  esquema: Esquema<T>,
  transformar: (datos: Record<string, unknown>) => Record<string, unknown> = (d) => d,
): { datos: T; errores: null } | { datos: null; errores: ErroresDeCampo } {
  const crudo: Record<string, unknown> = {};
  new FormData(formulario).forEach((valor, campo) => {
    if (typeof valor === "string" && valor.trim() !== "") crudo[campo] = valor.trim();
  });

  const resultado = esquema.safeParse(transformar(crudo));
  if (resultado.success) return { datos: resultado.data, errores: null };

  const errores: ErroresDeCampo = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path.map(String).join(".") || "_";
    errores[campo] ??= problema.message;
  }
  return { datos: null, errores };
}

/** Errores de campo que devuelve el API (400) en el mismo formato. */
export function erroresDeApi(error: unknown): ErroresDeCampo {
  if (!(error instanceof ErrorDeApi) || !error.errores) return {};
  return Object.fromEntries(error.errores.map((e) => [e.campo, e.mensaje]));
}

/** Mensaje para mostrar al usuario: el del API si lo hay, si no uno genérico. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeApi) return error.message;
  if (error instanceof TypeError)
    return "No pudimos conectar con el servidor. Revisá tu conexión.";
  return "Algo salió mal. Intentá de nuevo.";
}

/**
 * Tema claro (papel) u oscuro (negro cálido). Por defecto sigue al sistema;
 * el usuario puede fijarlo en Ajustes. La preferencia vive en el navegador.
 */

export type Tema = "sistema" | "claro" | "oscuro";

export const CLAVE_TEMA = "vetify:tema";

/** Se ejecuta en <head> antes de pintar para evitar el parpadeo de tema. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CLAVE_TEMA}")||"sistema";var o=t==="oscuro"||(t==="sistema"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",o)}catch(e){}})()`;

export function leerTema(): Tema {
  try {
    const valor = localStorage.getItem(CLAVE_TEMA);
    return valor === "claro" || valor === "oscuro" ? valor : "sistema";
  } catch {
    return "sistema";
  }
}

export function aplicarTema(tema: Tema): void {
  try {
    if (tema === "sistema") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Almacenamiento bloqueado: el tema dura lo que la pestaña.
  }
  const oscuro =
    tema === "oscuro" ||
    (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", oscuro);
}

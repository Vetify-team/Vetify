import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verificar carné · Vetify" };

/**
 * Ruta pública, sin sesión: la abre quien escanea el QR del carné.
 * Muestra únicamente la vigencia de vacunas, nunca el expediente completo.
 */
export default async function PaginaVerificar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: _token } = await params;

  // Pendiente: consultar /verificar/:token en el API y renderizar el carné.
  return <h1 className="font-serif text-2xl">Verificación de carné</h1>;
}

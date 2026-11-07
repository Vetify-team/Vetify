import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verificar carné · Vetify" };

/**
 * Public route without a session: opened by whoever scans the card's QR.
 * It will show only vaccine validity, never the full record.
 */
export default async function VerifyCardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: _token } = await params;
  // Pending: fetch /api/v1/card/:token and render the card.
  return <h1 className="font-display text-3xl">Verificación de carné</h1>;
}

import { redirect } from "next/navigation";

/**
 * A card link with the token in the path (typed by hand or from an old
 * version) goes to the real page, which reads the token from the #fragment.
 */
export default async function VerifyCardTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/verificar#${encodeURIComponent(token)}`);
}

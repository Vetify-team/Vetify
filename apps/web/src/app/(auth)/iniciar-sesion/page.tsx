import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Set by Ajustes → Cerrar cuenta after the account is erased.
  const { cuenta } = await searchParams;
  return <LoginForm accountClosed={cuenta === "cerrada"} />;
}

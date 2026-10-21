import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta · Vetify" };

export default function Page() {
  return <RegisterForm />;
}

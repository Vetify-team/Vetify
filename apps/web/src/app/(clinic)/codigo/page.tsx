import type { Metadata } from "next";
import { LinkCodeScreen } from "@/components/clinic/link-code";

export const metadata: Metadata = { title: "Código de vinculación" };

export default function Page() {
  return <LinkCodeScreen />;
}

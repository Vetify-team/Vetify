import type { Metadata } from "next";
import { Settings } from "@/components/owner/settings";

export const metadata: Metadata = { title: "Ajustes · Vetify" };

export default function Page() {
  return <Settings />;
}

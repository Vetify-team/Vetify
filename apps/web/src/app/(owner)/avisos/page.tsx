import type { Metadata } from "next";
import { Alerts } from "@/components/owner/alerts";

export const metadata: Metadata = { title: "Avisos · Vetify" };

export default function Page() {
  return <Alerts />;
}

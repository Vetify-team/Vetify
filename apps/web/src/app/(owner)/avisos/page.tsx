import type { Metadata } from "next";
import { Alerts } from "@/components/owner/alerts";

export const metadata: Metadata = { title: "Avisos" };

export default function Page() {
  return <Alerts />;
}

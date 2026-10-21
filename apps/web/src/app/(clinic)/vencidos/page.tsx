import type { Metadata } from "next";
import { Overdue } from "@/components/clinic/overdue";

export const metadata: Metadata = { title: "Esquemas vencidos · Vetify" };

export default function Page() {
  return <Overdue />;
}

import type { Metadata } from "next";
import { GoToPet } from "@/components/owner/go-to-pet";

export const metadata: Metadata = { title: "Carné" };

export default function Page() {
  return <GoToPet section="carne" />;
}

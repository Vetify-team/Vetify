import type { Metadata } from "next";
import { TeamScreen } from "@/components/clinic/team";

export const metadata: Metadata = { title: "Equipo" };

export default function Page() {
  return <TeamScreen />;
}

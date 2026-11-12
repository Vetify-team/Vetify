import type { Metadata } from "next";
import { AcceptInvitation } from "@/components/auth/accept-invitation";

export const metadata: Metadata = { title: "Invitación al equipo" };

export default function Page() {
  return <AcceptInvitation />;
}

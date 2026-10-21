import type { Metadata } from "next";
import { OwnerSchedule } from "@/components/record/owner-schedule";

export const metadata: Metadata = { title: "Vacunación · Vetify" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerSchedule id={id} />;
}

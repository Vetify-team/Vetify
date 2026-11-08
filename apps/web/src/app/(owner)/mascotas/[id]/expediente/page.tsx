import type { Metadata } from "next";
import { OwnerRecord } from "@/components/record/owner-record";

export const metadata: Metadata = { title: "Expediente" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerRecord id={id} />;
}

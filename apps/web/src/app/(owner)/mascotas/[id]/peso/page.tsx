import type { Metadata } from "next";
import { OwnerWeight } from "@/components/record/owner-weight";

export const metadata: Metadata = { title: "Serie de peso · Vetify" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerWeight id={id} />;
}

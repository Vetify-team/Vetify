import type { Metadata } from "next";
import { OwnerPermissions } from "@/components/permissions/owner-permissions";

export const metadata: Metadata = { title: "Permisos · Vetify" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerPermissions id={id} />;
}

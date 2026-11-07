"use client";

import type { UserRole } from "@vetify/types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/** Home screen of each role. */
export const homeOf = (role: UserRole): string =>
  role === "owner" ? "/mascotas" : role === "clinic" ? "/pacientes" : "/admin/clinicas";

/**
 * Redirects whoever has no session or not the area's role. Navigation only:
 * the real authorization is enforced by the API on every request.
 */
export function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { loading, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/iniciar-sesion");
    else if (user.role !== role) router.replace(homeOf(user.role));
  }, [loading, user, role, router]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  return children;
}

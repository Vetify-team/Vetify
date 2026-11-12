"use client";

import type { UserRole } from "@vetify/types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { homeTarget } from "@/lib/sites";

/**
 * Sends the user to their role's home: within this site with the router, or
 * with a full page load when the home is on another site.
 */
export function goHome(router: { replace: (path: string) => void }, role: UserRole) {
  const target = homeTarget(role, window.location.host);
  if (target.type === "url") window.location.replace(target.url);
  else router.replace(target.path);
}

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
    else if (user.role !== role) goHome(router, user.role);
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

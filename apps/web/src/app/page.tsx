"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { goHome } from "@/components/protected-route";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/** Entry point: sends each user to their home, or to the welcome screen. */
export default function Home() {
  const { loading, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) goHome(router, user.role);
    else router.replace("/registro");
  }, [loading, user, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Skeleton className="h-10 w-32" />
    </main>
  );
}

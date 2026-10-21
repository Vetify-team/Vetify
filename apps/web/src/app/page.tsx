"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeOf } from "@/components/protected-route";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/** Entry point: sends each user to their home, or to the login screen. */
export default function Home() {
  const { loading, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(user ? homeOf(user.role) : "/iniciar-sesion");
  }, [loading, user, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Skeleton className="h-10 w-32" />
    </main>
  );
}

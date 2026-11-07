"use client";

import { usePathname } from "next/navigation";
import { OwnerPageSkeleton, ownerSkeletonForPath } from "@/components/owner/owner-page-skeleton";

export default function Loading() {
  return <OwnerPageSkeleton page={ownerSkeletonForPath(usePathname())} />;
}

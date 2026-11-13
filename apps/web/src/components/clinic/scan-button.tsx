import { ScanLine } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

/** Opens the card scanner. */
export function ScanButton() {
  return (
    <Link
      href="/escanear"
      className={cn(
        buttonVariants({ variant: "solido" }),
        "h-11 gap-2 rounded-full px-5",
      )}
    >
      <ScanLine aria-hidden /> Escanear carné
    </Link>
  );
}

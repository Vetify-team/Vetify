import { ScanLine } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

/**
 * Opens the card scanner with a full page load, not a client-side one: the
 * camera is allowed only by /escanear's own Permissions-Policy, which a
 * document gets when it loads.
 */
export function ScanButton() {
  return (
    <a
      href="/escanear"
      className={cn(
        buttonVariants({ variant: "solido" }),
        "h-11 gap-2 rounded-full px-5",
      )}
    >
      <ScanLine aria-hidden /> Escanear carné
    </a>
  );
}

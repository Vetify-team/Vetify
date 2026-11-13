"use client";

import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** A button that opens a form in a dialog and closes it when saved. */
export function ActionDialog({
  text,
  title,
  description,
  primary,
  icon: Icon,
  className,
  children,
}: {
  text: string;
  title: string;
  description: string;
  primary?: boolean;
  icon?: LucideIcon;
  /** Extra classes for the trigger button. */
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={primary ? "solido" : "outline"}
            className={cn(Icon && "gap-2", className)}
          />
        }
      >
        {Icon && <Icon aria-hidden />}
        {text}
      </DialogTrigger>
      <DialogContent className="gap-6 rounded-lg p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

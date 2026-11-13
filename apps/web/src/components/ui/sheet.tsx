"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

/**
 * Side panel on a large screen and full screen on a phone, on the same
 * primitive as the dialog (focus trap, Escape, scroll lock). The popup stays
 * mounted while closed, so what is inside (a conversation) survives closing
 * and opening it again.
 */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props) {
  return (
    <SheetPrimitive.Portal keepMounted>
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/20 duration-150 supports-backdrop-filter:backdrop-blur-xs data-closed:hidden data-open:animate-in data-open:fade-in-0"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          // Phone: the whole screen, inside the notch and the home indicator.
          "fixed inset-0 z-50 flex h-dvh flex-col bg-background text-foreground outline-none",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          // Large screen: a panel on the right.
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[30rem] sm:max-w-full sm:border-l sm:border-border sm:shadow-xl",
          "duration-200 data-closed:hidden data-open:animate-in data-open:slide-in-from-right-8 data-open:fade-in-0",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display text-2xl font-medium leading-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };

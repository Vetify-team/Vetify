"use client";

import { ChevronRight, ExternalLink, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "cn";

/**
 * Settings as grouped lists, in the manner of the iPhone's Settings: rounded
 * blocks apart from each other, a small title above each and an optional
 * note below. Each row: an icon in a soft colored square, its text, a value
 * or a switch on the right, and a chevron when it opens something else.
 */

export type Tint = "gold" | "green" | "amber" | "red" | "blue" | "plum" | "gray";

const TINTS: Record<Tint, string> = {
  gold: "bg-[#f1e3c6] text-[#7a5212] dark:bg-[#4a3a1f] dark:text-[#f0d9a8]",
  green: "bg-[#dbe8d6] text-[#2f6b3e] dark:bg-[#2c3f2c] dark:text-[#bfe0c3]",
  amber: "bg-[#f4e1c0] text-[#94600a] dark:bg-[#4a3a1c] dark:text-[#f0cf8f]",
  red: "bg-[#f3d6cd] text-[#a3381f] dark:bg-[#4d2a22] dark:text-[#f2b9a9]",
  blue: "bg-[#d6e2e9] text-[#2e4854] dark:bg-[#26363e] dark:text-[#c7dbe4]",
  plum: "bg-[#e8d8e3] text-[#5b3150] dark:bg-[#3e2b39] dark:text-[#e8cde0]",
  gray: "bg-muted text-muted-foreground",
};

export function SettingsGroup({
  title,
  note,
  children,
  id,
}: {
  title?: string;
  /** Explanation under the block, when the rows need one. */
  note?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="flex scroll-mt-8 flex-col gap-1.5"
    >
      {title && (
        <h2
          id={titleId}
          className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {title}
        </h2>
      )}
      <ul className="overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06)] dark:ring-1 dark:ring-border [&>li+li_[data-sep]]:border-t">
        {children}
      </ul>
      {note && (
        <p className="px-4 text-xs leading-relaxed text-muted-foreground">{note}</p>
      )}
    </section>
  );
}

interface RowContent {
  icon: LucideIcon;
  tint: Tint;
  label: ReactNode;
  /** Secondary line under the label. */
  detail?: ReactNode;
  /** Value on the right ("Gratuito", the email…). */
  value?: ReactNode;
  /** A control on the right (a switch, a select); replaces value and chevron. */
  control?: ReactNode;
  /** Red text, for the danger zone. */
  destructive?: boolean;
}

function Inner({
  icon: Icon,
  tint,
  label,
  detail,
  value,
  control,
  destructive,
  chevron,
}: RowContent & { chevron?: "go" | "external" | false }) {
  return (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[0.6rem]",
          TINTS[tint],
        )}
      >
        <Icon className="size-[1.1rem]" strokeWidth={1.9} aria-hidden />
      </span>
      {/* The inset separator starts after the icon, as on iOS. */}
      <span
        data-sep
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 self-stretch border-border/70 py-2.5 pr-4"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate", destructive && "text-alert")}>
            {label}
          </span>
          {detail && (
            <span className="block text-xs text-muted-foreground">{detail}</span>
          )}
        </span>
        {control ?? (
          <>
            {value !== undefined && (
              <span className="max-w-[55%] truncate text-sm text-muted-foreground">
                {value}
              </span>
            )}
            {chevron === "go" && (
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground/70"
                aria-hidden
              />
            )}
            {chevron === "external" && (
              <ExternalLink
                className="size-4 shrink-0 text-muted-foreground/70"
                aria-hidden
              />
            )}
          </>
        )}
      </span>
    </>
  );
}

const rowClass =
  "flex w-full items-center gap-3 pl-4 text-left outline-none transition-colors focus-visible:bg-muted";

/** A row that shows something: a value, or a control such as a switch. */
export function SettingsRow(props: RowContent) {
  return (
    <li>
      <div className={rowClass}>
        <Inner {...props} />
      </div>
    </li>
  );
}

/** A row that opens another screen of the app (or, `external`, another site). */
export function SettingsLink({
  href,
  external,
  ...props
}: RowContent & { href: string; external?: boolean }) {
  const className = cn(rowClass, "hover:bg-muted/60 active:bg-muted");
  return (
    <li>
      {external ? (
        <a href={href} className={className}>
          <Inner {...props} chevron="external" />
        </a>
      ) : (
        <Link href={href} className={className}>
          <Inner {...props} chevron="go" />
        </Link>
      )}
    </li>
  );
}

/**
 * A row that does something here (opens a dialog, logs out). It forwards
 * its ref and props so a dialog can use it as its trigger.
 */
export const SettingsButton = forwardRef<
  HTMLButtonElement,
  RowContent & { chevron?: boolean } & Omit<ComponentPropsWithoutRef<"button">, "value">
>(function SettingsButton(
  {
    icon,
    tint,
    label,
    detail,
    value,
    control,
    destructive,
    chevron = true,
    className,
    ...button
  },
  ref,
) {
  return (
    <li>
      <button
        ref={ref}
        type="button"
        {...button}
        className={cn(
          rowClass,
          "hover:bg-muted/60 active:bg-muted disabled:opacity-60",
          className,
        )}
      >
        <Inner
          icon={icon}
          tint={tint}
          label={label}
          detail={detail}
          value={value}
          control={control}
          destructive={destructive}
          chevron={chevron ? "go" : false}
        />
      </button>
    </li>
  );
});

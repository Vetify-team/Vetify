"use client";

import {
  ShieldCheck,
  Check,
  CheckCheck,
  Pill,
  Scale,
  Syringe,
  Trash2,
  Bell,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useInbox } from "@/hooks/useInbox";
import {
  describeNotice,
  groupNotices,
  kindOf,
  noticeHref,
  swipeAction,
  toneOfNotice,
  type InboxItem,
  type InboxKind,
} from "@/lib/inbox";
import type { Tone } from "@/lib/pet-summary";
import { TextRowsSkeleton } from "./owner-page-skeleton";

const ICON: Record<InboxKind, LucideIcon> = {
  vaccination: Syringe,
  deworming: Pill,
  weight: Scale,
  access: ShieldCheck,
  other: Bell,
};
const BADGE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/14 text-warn",
  alert: "bg-alert/12 text-alert",
  muted: "bg-muted text-muted-foreground",
};

/**
 * The owner's notices, grouped by today, this week and before. On a phone a
 * row swipes right to mark it read and left to remove it; the same actions
 * are buttons on every row, for the mouse, the keyboard and screen readers.
 */
export function NotificationInbox() {
  const inbox = useInbox();
  const unread = inbox.data?.filter((i) => !i.readAt).length ?? 0;

  return (
    <section aria-labelledby="inbox-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="inbox-title" className="font-display text-3xl leading-tight">
          Notificaciones
          {unread > 0 && (
            <span className="ml-2 align-middle rounded-full bg-primary px-2 py-0.5 font-sans text-xs font-semibold text-primary-foreground">
              {unread} {unread === 1 ? "nueva" : "nuevas"}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={!unread || inbox.readAll.isPending}
          onClick={() => inbox.readAll.mutate()}
        >
          <CheckCheck aria-hidden /> Marcar todo como leído
        </Button>
      </div>

      {inbox.isPending ? (
        <TextRowsSkeleton rows={2} />
      ) : inbox.isError ? (
        <p role="alert" className="text-sm">
          No se pudieron cargar las notificaciones.
        </p>
      ) : !inbox.data.length ? (
        <p className="rounded-3xl bg-card p-5 text-sm text-muted-foreground shadow-sm">
          No tenés notificaciones. Te avisamos cuando se acerque una vacuna o
          desparasitación, o cuando el peso cambie de golpe.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground md:hidden">
            Deslizá a la derecha para marcar como leída y a la izquierda para borrarla.
          </p>
          {groupNotices(inbox.data).map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="px-1 pt-2 text-sm font-medium text-muted-foreground">
                {group}
              </h3>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <SwipeRow
                      item={item}
                      onRead={() => inbox.read.mutate(item.id)}
                      onDismiss={() => inbox.dismiss.mutate(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {(inbox.read.isError || inbox.dismiss.isError || inbox.readAll.isError) && (
            <p role="alert" className="text-sm text-alert">
              No se pudo guardar el cambio. Intentá de nuevo.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SwipeRow({
  item,
  onRead,
  onDismiss,
}: {
  item: InboxItem;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const unread = !item.readAt;
  const { title, detail } = describeNotice(item);
  const tone = toneOfNotice(item);
  const Icon = ICON[kindOf(item)];

  // Touch only: a mouse drag would fight with selecting text.
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    start.current = { x: event.clientX, y: event.clientY, swiping: false };
  };
  const move = (event: PointerEvent) => {
    const from = start.current;
    if (!from) return;
    const x = event.clientX - from.x;
    const y = event.clientY - from.y;
    // Decide once: a mostly vertical move is a scroll, not a swipe.
    if (!from.swiping) {
      if (Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) return (start.current = null);
      if (Math.abs(x) < 8) return;
      from.swiping = true;
      setDragging(true);
    }
    setDx(x);
  };
  const up = () => {
    const from = start.current;
    start.current = null;
    setDragging(false);
    if (!from?.swiping) return;
    const action = swipeAction(dx, row.current?.offsetWidth ?? 0, unread);
    if (action === "dismiss") {
      setLeaving(true);
      setDx(-(row.current?.offsetWidth ?? 400));
      setTimeout(onDismiss, 180);
      return;
    }
    if (action === "read") onRead();
    setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* What the swipe reveals: read on the left, remove on the right. */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-between px-5 text-sm font-medium"
      >
        <span className={cn("flex items-center gap-2 text-ok", dx <= 0 && "invisible")}>
          <Check className="size-5" /> Leída
        </span>
        <span
          className={cn("flex items-center gap-2 text-alert", dx >= 0 && "invisible")}
        >
          Borrar <Trash2 className="size-5" />
        </span>
      </div>
      <div
        ref={row}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        style={{ transform: `translateX(${dx}px)` }}
        className={cn(
          "relative flex touch-pan-y items-center gap-3 bg-card p-3.5 shadow-[0_1px_2px_rgba(29,27,24,0.06)] select-none dark:ring-1 dark:ring-border",
          !dragging && "transition-transform duration-200",
          leaving && "opacity-0 transition-all",
          dx > 0 && "bg-ok/5",
          dx < 0 && "bg-alert/5",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            BADGE[tone],
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <Link
          href={noticeHref(item)}
          onClick={() => unread && onRead()}
          draggable={false}
          className="min-w-0 flex-1 outline-none focus-visible:underline"
        >
          <span
            className={cn(
              "flex items-baseline gap-2",
              unread ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {unread && (
              <span
                aria-hidden
                className="size-2 shrink-0 -translate-y-px rounded-full bg-primary"
              />
            )}
            <span className="line-clamp-2 leading-snug">{title}</span>
            {unread && <span className="sr-only">(nueva)</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
        </Link>
        <div className="flex shrink-0 items-center">
          {unread && (
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={onRead}
              aria-label={`Marcar como leída: ${title}`}
              title="Marcar como leída"
            >
              <Check aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:text-alert"
            onClick={onDismiss}
            aria-label={`Borrar: ${title}`}
            title="Borrar"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

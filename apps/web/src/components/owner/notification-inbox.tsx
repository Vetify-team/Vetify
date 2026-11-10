"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { TextRowsSkeleton } from "./owner-page-skeleton";
import { Section } from "@/components/system";

export function NotificationInbox() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications(),
  });
  const read = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <Section title="Notificaciones">
      {query.isPending ? (
        <TextRowsSkeleton rows={1} />
      ) : query.isError ? (
        <p>No se pudieron cargar las notificaciones.</p>
      ) : !query.data.length ? (
        <p className="text-sm text-muted-foreground">Todavía no tenés notificaciones.</p>
      ) : (
        <ul>
          {query.data.map((item) => (
            <li key={item.id} className="border-b border-border py-3">
              <Link
                href={`/mascotas/${item.petId}/${item.kind === "weight" ? "peso" : "vacunas"}`}
                onClick={() => {
                  if (!item.readAt) read.mutate(item.id);
                }}
                className="text-primary underline"
              >
                {!item.readAt && <strong>Nueva · </strong>}
                {item.kind === "weight"
                  ? `El peso de ${item.petName} ${item.subject}`
                  : `${item.subject} de ${item.petName}`}
              </Link>
              <p className="text-sm text-muted-foreground">
                {item.kind === "weight"
                  ? `Cambio brusco en el registro del ${formatDate(item.dueOn)}`
                  : `${item.offsetDays === 7 ? "Próxima fecha" : "Corresponde hoy"}: ${formatDate(item.dueOn)}`}
              </p>
              {!item.readAt && (
                <button
                  className="text-sm underline"
                  onClick={() => read.mutate(item.id)}
                  disabled={read.isPending}
                >
                  Marcar como leída
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

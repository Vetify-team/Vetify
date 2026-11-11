"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Section } from "@/components/system";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";

const KEY = ["email-reminders"];

/** Reminders by email, on by default; the owner can turn them off. */
export function EmailSettings() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: () => api.emailReminders() });
  const update = useMutation({
    mutationFn: (enabled: boolean) => api.setEmailReminders(enabled),
    onSuccess: (data) => client.setQueryData(KEY, data),
  });
  const enabled = update.isPending ? update.variables : query.data?.enabled;
  return (
    <Section title="Recordatorios por correo">
      <div className="flex items-start justify-between gap-6 pt-4">
        <p className="text-sm text-muted-foreground">
          Te escribimos cuando una vacuna o desparasitación se acerca o corresponde hoy, y
          cuando el peso de tu mascota cambia de golpe.
        </p>
        <Switch
          checked={enabled ?? false}
          disabled={query.isPending || update.isPending}
          onCheckedChange={(value) => update.mutate(value)}
          aria-label="Recordatorios por correo"
        />
      </div>
      {(query.isError || update.isError) && (
        <p role="alert" className="pt-2 text-sm text-destructive">
          No se pudo {update.isError ? "guardar" : "cargar"} la preferencia. Intentá de
          nuevo.
        </p>
      )}
    </Section>
  );
}

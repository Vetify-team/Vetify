"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import type { z } from "zod";
import { FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, validateForm, type FieldErrors } from "@/lib/forms";

/**
 * A short form validated with a @vetify/types schema that calls a mutation
 * and clears itself when saved.
 */
export function QuickForm<T>({
  title,
  schema,
  mutation,
  transform,
  submitText = "Guardar",
  children,
  onSaved,
}: {
  title?: string;
  schema: z.ZodType<T>;
  mutation: UseMutationResult<unknown, unknown, T>;
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
  submitText?: string;
  children: (errors: FieldErrors) => ReactNode;
  onSaved?: () => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors } = validateForm(form, schema, transform);
    setErrors(errors ?? {});
    setSaved(false);
    if (!data) return;
    mutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setSaved(true);
        onSaved?.();
      },
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {title && <h3 className="titulo-seccion">{title}</h3>}
      {children(errors)}
      <FormError message={mutation.isError ? errorMessage(mutation.error) : null} />
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          ✓ Guardado en el expediente.
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Guardando…" : submitText}
      </Button>
    </form>
  );
}

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";

const controlClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive md:text-sm";

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

function Wrapper({
  label,
  name,
  error,
  hint,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Text field with a visible label and an accessible error. */
export function Field({
  label,
  name,
  error,
  hint,
  ...rest
}: FieldProps & Omit<ComponentProps<"input">, "name" | "id">) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      <Input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className="h-11 rounded-md bg-transparent px-3"
        {...rest}
      />
    </Wrapper>
  );
}

export function Select({
  label,
  name,
  error,
  hint,
  options,
  ...rest
}: FieldProps & { options: { value: string; text: string }[] } & Omit<
    ComponentProps<"select">,
    "name" | "id"
  >) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      <select
        id={name}
        name={name}
        aria-invalid={!!error}
        className={controlClass}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.text}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function TextArea({
  label,
  name,
  error,
  hint,
  ...rest
}: FieldProps & Omit<ComponentProps<"textarea">, "name" | "id">) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      <textarea
        id={name}
        name={name}
        aria-invalid={!!error}
        rows={3}
        className={`${controlClass} h-auto py-2`}
        {...rest}
      />
    </Wrapper>
  );
}

/** A form-level error (not tied to a field). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="border-l-2 border-destructive py-1 pl-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

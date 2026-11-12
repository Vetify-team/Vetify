"use client";

import { CalendarDays, Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

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
  type,
  ...rest
}: FieldProps & Omit<ComponentProps<"input">, "name" | "id">) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputProps = {
    id: name,
    name,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${name}-error` : undefined,
    ...rest,
  };
  if (type === "date") {
    return (
      <Wrapper label={label} name={name} error={error} hint={hint}>
        <DateInput {...inputProps} />
      </Wrapper>
    );
  }
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      <div className="relative">
        <Input
          {...inputProps}
          className={`h-11 rounded-md bg-transparent px-3 ${isPassword ? "pr-12" : ""}`}
          type={isPassword && visible ? "text" : type}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            disabled={rest.disabled}
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {visible ? (
              <EyeOff aria-hidden="true" size={20} />
            ) : (
              <Eye aria-hidden="true" size={20} />
            )}
          </button>
        )}
      </div>
    </Wrapper>
  );
}

/**
 * Date field that looks the same on every phone. Phones draw the native
 * control their own way (iOS centers it, narrow columns crop it, the format
 * follows the device language), so below `md` the native input stays on top,
 * transparent, to open the system picker on tap, and the value is drawn
 * underneath as "11 nov 2026". From `md` up the native input shows as is,
 * where it can also be typed with the keyboard.
 */
function DateInput({ value, defaultValue, onChange, ...rest }: ComponentProps<"input">) {
  const ref = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState(String(value ?? defaultValue ?? ""));
  const shown = value === undefined ? own : String(value);

  // form.reset() puts the default value back without a change event.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const sync = () => requestAnimationFrame(() => setOwn(ref.current?.value ?? ""));
    form.addEventListener("reset", sync);
    return () => form.removeEventListener("reset", sync);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="date"
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => {
          setOwn(event.target.value);
          onChange?.(event);
        }}
        onClick={(event) => {
          // Phones open their picker on any tap; a narrow desktop window only
          // does from the (hidden) calendar icon, so open it from anywhere.
          if (!matchMedia("(max-width: 767px)").matches) return;
          try {
            event.currentTarget.showPicker?.();
          } catch {
            // Not allowed here (e.g. already open); the tap still focuses it.
          }
        }}
        className="peer h-11 rounded-md bg-transparent px-3 max-md:absolute max-md:inset-0 max-md:z-10 max-md:cursor-pointer max-md:appearance-none max-md:opacity-0"
        {...rest}
      />
      <div
        aria-hidden="true"
        className="flex h-11 items-center justify-between gap-2 rounded-md border border-input px-3 text-base transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 peer-disabled:opacity-50 peer-aria-invalid:border-destructive md:hidden dark:bg-input/30"
      >
        <span className={`truncate ${shown ? "" : "text-muted-foreground"}`}>
          {shown ? formatDate(shown) : "Elegir"}
        </span>
        <CalendarDays aria-hidden="true" size={18} className="shrink-0 text-primary" />
      </div>
    </div>
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

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";

const claseControl =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive md:text-sm";

interface PropsCampo {
  etiqueta: string;
  nombre: string;
  error?: string;
  ayuda?: ReactNode;
}

function Envoltura({
  etiqueta,
  nombre,
  error,
  ayuda,
  children,
}: PropsCampo & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="text-sm text-muted-foreground">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={`${nombre}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>
      )}
    </div>
  );
}

/** Campo de texto con etiqueta visible y error accesible. */
export function Campo({
  etiqueta,
  nombre,
  error,
  ayuda,
  ...resto
}: PropsCampo & Omit<ComponentProps<"input">, "name" | "id">) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <Input
        id={nombre}
        name={nombre}
        aria-invalid={!!error}
        aria-describedby={error ? `${nombre}-error` : undefined}
        className="h-11 rounded-md bg-transparent px-3"
        {...resto}
      />
    </Envoltura>
  );
}

export function Selector({
  etiqueta,
  nombre,
  error,
  ayuda,
  opciones,
  ...resto
}: PropsCampo & {
  opciones: { valor: string; texto: string }[];
} & Omit<ComponentProps<"select">, "name" | "id">) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <select
        id={nombre}
        name={nombre}
        aria-invalid={!!error}
        className={claseControl}
        {...resto}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </Envoltura>
  );
}

export function AreaTexto({
  etiqueta,
  nombre,
  error,
  ayuda,
  ...resto
}: PropsCampo & Omit<ComponentProps<"textarea">, "name" | "id">) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <textarea
        id={nombre}
        name={nombre}
        aria-invalid={!!error}
        rows={3}
        className={`${claseControl} h-auto py-2`}
        {...resto}
      />
    </Envoltura>
  );
}

/** Error general del formulario (no asociado a un campo). */
export function ErrorFormulario({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {mensaje}
    </p>
  );
}

import type { ComponentProps } from "react";
import { cn } from "cn";

/** A selectable card or chip. The selection is announced with aria-pressed, not only color. */
export function ChoiceCard({
  selected,
  className,
  ...props
}: { selected: boolean } & Omit<ComponentProps<"button">, "type">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "border-[1.5px] border-border bg-card text-left text-foreground transition-colors hover:border-input",
        "aria-pressed:border-primary aria-pressed:bg-primary/8",
        className,
      )}
      {...props}
    />
  );
}

/** Pills for short choices (sex, neutered). */
export function ChoiceChips<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-muted-foreground">{legend}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={o.value === value}
            onClick={() => onChange(o.value)}
            className="h-11 flex-1 rounded-full text-center text-sm"
          >
            {o.text}
          </ChoiceCard>
        ))}
      </div>
    </fieldset>
  );
}

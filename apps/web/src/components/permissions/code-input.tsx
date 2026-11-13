"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import {
  activeBox,
  CODE_LENGTH,
  codeFromPaste,
  formatCode,
  normalizeCode,
} from "@/lib/link-code";

/**
 * The clinic's link code in boxes, XXXX-XXXX, like a verification code.
 *
 * One real input carries the value, laid over eight painted boxes: screen
 * readers hear a single field with the whole code, not eight loose ones.
 * Typing fills the next box, Backspace empties the last one, and pasting the
 * code (with or without its hyphen) fills them all. Upper case and only the
 * code's characters are kept. Phones show their text keyboard in capitals.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  label = "Código de la clínica",
  invalid,
  describedBy,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Called once the eighth character is in. */
  onComplete?: (code: string) => void;
  label?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const caret = activeBox(value);

  const update = (raw: string) => {
    const code = normalizeCode(raw);
    onChange(code);
    if (code.length === CODE_LENGTH && value.length !== CODE_LENGTH) onComplete?.(code);
  };

  const box = (index: number) => {
    const char = value[index];
    const current = focused && index === caret && !disabled;
    return (
      <span
        key={index}
        className={cn(
          "flex h-14 w-10 items-center justify-center rounded-xl border-2 bg-card font-mono text-2xl font-semibold transition-colors sm:h-16 sm:w-12",
          invalid ? "border-alert" : current ? "border-primary" : "border-input",
          char && !invalid && "border-foreground/30",
        )}
      >
        {char ??
          (current ? <span className="h-7 w-0.5 animate-pulse bg-primary" /> : null)}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <div className="relative w-fit">
        <div aria-hidden className="flex items-center gap-1.5 sm:gap-2">
          {[0, 1, 2, 3].map(box)}
          <span className="px-0.5 text-2xl text-muted-foreground">-</span>
          {[4, 5, 6, 7].map(box)}
        </div>
        <input
          id={id}
          value={formatCode(value)}
          onChange={(event) => update(event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            update(codeFromPaste(value, event.clipboardData.getData("text")));
          }}
          onFocus={(event) => {
            setFocused(true);
            // Always type at the end: the boxes fill left to right.
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }}
          onBlur={() => setFocused(false)}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={CODE_LENGTH + 1}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          // Invisible but real: it takes the taps, the keyboard and the paste.
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </div>
    </div>
  );
}

import type { SVGProps } from "react";

/**
 * Vetify's assistant: a paw print inside a speech bubble. Drawn on lucide's
 * 24 px grid with its stroke (currentColor, round caps and joins, width 2 by
 * default), so it sits next to lucide icons without looking foreign.
 */
export function AssistantIcon({
  strokeWidth = 2,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...props}
    >
      {/* The bubble, with its tail at the bottom left. */}
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      {/* The paw: a pad and four toes. */}
      <path d="M9.6 15.4c0-1.5 1.1-2.8 2.4-2.8s2.4 1.3 2.4 2.8c0 .8-.7 1.3-1.5 1.1a3.6 3.6 0 0 0-1.8 0c-.8.2-1.5-.3-1.5-1.1Z" />
      <circle cx="8.6" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="8.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="8.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

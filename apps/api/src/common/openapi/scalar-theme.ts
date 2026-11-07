/**
 * Scalar theme with Vetify's identity: paper or warm black, Cormorant
 * Garamond + Lora, and gold only for actionable things. Same values as the
 * tokens in apps/web/src/app/globals.css. There is no third-party font
 * import (it would leak visitors' IPs and loosen the CSP): the fonts apply
 * where the page provides them, as the docs site does, and fall back to
 * Georgia otherwise.
 */
export const SCALAR_THEME = `
:root {
  --scalar-font: 'Lora', Georgia, serif;
  --scalar-heading-font: 'Cormorant Garamond', Georgia, serif;
  --scalar-radius: 6px;
  --scalar-radius-lg: 8px;
}
.light-mode {
  --scalar-color-1: #1d1b18;
  --scalar-color-2: #4a453e;
  --scalar-color-3: #6a645a;
  --scalar-color-accent: #8a5c14;
  --scalar-background-1: #f4efe5;
  --scalar-background-2: #faf7f0;
  --scalar-background-3: #ebe4d6;
  --scalar-background-accent: #8a5c1414;
  --scalar-border-color: #d8cfbf;
  --scalar-button-1: #8a5c14;
  --scalar-button-1-color: #faf7f0;
  --scalar-button-1-hover: #6f4a10;
}
.dark-mode {
  --scalar-color-1: #efebe4;
  --scalar-color-2: #c8c2b8;
  --scalar-color-3: #a29b90;
  --scalar-color-accent: #dcaa5f;
  --scalar-background-1: #121110;
  --scalar-background-2: #1a1917;
  --scalar-background-3: #25231f;
  --scalar-background-accent: #dcaa5f1a;
  --scalar-border-color: #34312c;
  --scalar-button-1: #dcaa5f;
  --scalar-button-1-color: #121110;
  --scalar-button-1-hover: #e8bd7a;
}
.light-mode .t-doc__sidebar,
.dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-item-hover-background: var(--scalar-background-2);
  --scalar-sidebar-item-active-background: var(--scalar-background-3);
  --scalar-sidebar-border-color: var(--scalar-border-color);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-color-accent);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
}
h1, h2, h3, .section-header { font-family: var(--scalar-heading-font); font-weight: 500; }
/* Button of Scalar's commercial platform; not relevant to this project. */
.selected-client-action { display: none; }
`;

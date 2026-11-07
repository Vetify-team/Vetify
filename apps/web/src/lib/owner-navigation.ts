/** Resolve pet-specific tabs only from pets visible to the current owner. */
export function ownerTabHref(href: string, petId?: string): string {
  if (!petId) return href;
  if (href === "/esquema") return `/mascotas/${petId}/vacunas`;
  if (href === "/carne") return `/mascotas/${petId}/carne`;
  return href;
}

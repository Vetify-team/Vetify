/**
 * TanStack Query keys in one place, so a mutation knows exactly what to
 * invalidate and no loose strings are spread across the app.
 */
export const keys = {
  session: ["session"] as const,
  pets: () => ["pets"] as const,
  pet: (id: string) => ["pets", id] as const,
  record: (petId: string) => ["pets", petId, "record"] as const,
  vaccinationStatus: (petId: string) => ["pets", petId, "vaccination-status"] as const,
  permissions: (petId: string) => ["pets", petId, "permissions"] as const,
  accessLog: (petId: string, actor: string) =>
    ["pets", petId, "access-log", actor] as const,
  alerts: ["alerts"] as const,
  myClinic: ["clinics", "mine"] as const,
  adminClinics: (verified?: boolean) => ["admin", "clinics", String(verified)] as const,
} as const;

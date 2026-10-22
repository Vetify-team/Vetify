/**
 * Vetify's plans, as shown to users. The prices come from the business model
 * (docs/AVANCE_2.md §3). There is no billing yet: a plan that is not
 * `available` is shown but cannot be chosen.
 */

export type PlanId = "free" | "premium" | "pilot" | "office" | "clinic" | "chain";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  summary: string;
  features: string[];
  available: boolean;
}

/** How many pets the free plan covers. Shown only: the API does not enforce it yet. */
export const FREE_PLAN_LIMIT = 2;

export const OWNER_PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    price: "₡0",
    period: "siempre",
    summary: "Todo lo esencial. El expediente siempre es tuyo.",
    features: [
      "Expediente clínico completo",
      "Carné digital con QR",
      "Recordatorios básicos",
      `Hasta ${FREE_PLAN_LIMIT} mascotas`,
    ],
    available: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "₡1.500",
    period: "al mes",
    summary: "Para familias con varias mascotas.",
    features: [
      "Mascotas ilimitadas",
      "Respaldo de documentos",
      "Alertas avanzadas",
      "Exportación en PDF",
    ],
    available: false,
  },
];

export const CLINIC_PLANS: Plan[] = [
  {
    id: "pilot",
    name: "Piloto",
    price: "₡0",
    period: "3 meses",
    summary: "Para las primeras 10 clínicas.",
    features: ["Todo el portal clínico"],
    available: true,
  },
  {
    id: "office",
    name: "Consultorio",
    price: "₡15.000",
    period: "al mes",
    summary: "1 veterinario.",
    features: ["Portal de pacientes", "Registro del acto médico"],
    available: false,
  },
  {
    id: "clinic",
    name: "Clínica",
    price: "₡30.000",
    period: "al mes",
    summary: "Hasta 4 veterinarios.",
    features: ["Recordatorios a pacientes", "Reportes de adherencia"],
    available: false,
  },
  {
    id: "chain",
    name: "Cadena",
    price: "₡45.000",
    period: "al mes",
    summary: "5 o más veterinarios o varias sedes.",
    features: ["Analítica", "Resumen previo con IA"],
    available: false,
  },
];

export const OWNER_TERMS = [
  "Premium se cobra mes a mes en colones y lo cancelás cuando quieras desde Ajustes.",
  "Si volvés al plan gratuito no perdés nada: tus expedientes siguen siendo tuyos.",
  "Nunca pagás por acceder a los datos de tu mascota.",
  "[Política de reembolsos: por definir]",
];

export const CLINIC_TERMS = [
  "El piloto dura 3 meses y no pide método de pago.",
  "Al terminar el piloto elegís un plan para seguir recibiendo expedientes.",
  "Los expedientes pertenecen a los dueños; accedés con su permiso.",
  "[Facturación electrónica y reembolsos: por definir]",
];

/** The plan every account is on until billing exists. */
export const currentPlan = (role: "owner" | "clinic"): Plan =>
  role === "owner" ? OWNER_PLANS[0] : CLINIC_PLANS[0];

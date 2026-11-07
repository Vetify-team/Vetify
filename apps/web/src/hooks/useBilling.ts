"use client";

import type { PaidPlanId } from "@vetify/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { keys } from "./keys";

export function useBillingStatus() {
  return useQuery({ queryKey: keys.billing, queryFn: () => api.billingStatus() });
}

/** Creates the payment and leaves for Tilopay's hosted form. */
export function useCheckout() {
  return useMutation({
    mutationFn: (plan: PaidPlanId) => api.checkout(plan),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

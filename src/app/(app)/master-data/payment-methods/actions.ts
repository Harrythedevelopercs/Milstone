"use server";

import {
  createSimpleLookup,
  updateSimpleLookup,
  setSimpleLookupStatus,
} from "@/lib/actions/simple-lookup";
import type { ActionResult } from "@/lib/action-result";

export async function createPaymentMethod(name: string): Promise<ActionResult> {
  return createSimpleLookup("paymentMethod", name);
}

export async function updatePaymentMethod(id: string, name: string): Promise<ActionResult> {
  return updateSimpleLookup("paymentMethod", id, name);
}

export async function setPaymentMethodStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  return setSimpleLookupStatus("paymentMethod", id, status);
}

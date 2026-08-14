"use server";

import {
  createSimpleLookup,
  updateSimpleLookup,
  setSimpleLookupStatus,
} from "@/lib/actions/simple-lookup";
import type { ActionResult } from "@/lib/action-result";

export async function createPayoutMethod(name: string): Promise<ActionResult> {
  return createSimpleLookup("payoutMethod", name);
}

export async function updatePayoutMethod(id: string, name: string): Promise<ActionResult> {
  return updateSimpleLookup("payoutMethod", id, name);
}

export async function setPayoutMethodStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  return setSimpleLookupStatus("payoutMethod", id, status);
}

"use server";

import {
  createSimpleLookup,
  updateSimpleLookup,
  setSimpleLookupStatus,
} from "@/lib/actions/simple-lookup";
import type { ActionResult } from "@/lib/action-result";

export async function createBusinessUnit(name: string): Promise<ActionResult> {
  return createSimpleLookup("businessUnit", name);
}

export async function updateBusinessUnit(id: string, name: string): Promise<ActionResult> {
  return updateSimpleLookup("businessUnit", id, name);
}

export async function setBusinessUnitStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  return setSimpleLookupStatus("businessUnit", id, status);
}

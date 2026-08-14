"use server";

import {
  createSimpleLookup,
  updateSimpleLookup,
  setSimpleLookupStatus,
} from "@/lib/actions/simple-lookup";
import type { ActionResult } from "@/lib/action-result";

export async function createExpenseCategory(name: string): Promise<ActionResult> {
  return createSimpleLookup("expenseCategory", name);
}

export async function updateExpenseCategory(id: string, name: string): Promise<ActionResult> {
  return updateSimpleLookup("expenseCategory", id, name);
}

export async function setExpenseCategoryStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  return setSimpleLookupStatus("expenseCategory", id, status);
}

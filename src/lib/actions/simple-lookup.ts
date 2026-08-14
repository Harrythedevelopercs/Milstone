"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";

export type SimpleLookupModel =
  | "paymentMethod"
  | "payoutMethod"
  | "expenseCategory"
  | "businessUnit";

type SimpleLookupDelegate = {
  create(args: { data: { name: string } }): Promise<unknown>;
  update(args: {
    where: { id: string };
    data: { name?: string; status?: "ACTIVE" | "INACTIVE" };
  }): Promise<unknown>;
};

const REVALIDATE_PATH: Record<SimpleLookupModel, string> = {
  paymentMethod: "/master-data/payment-methods",
  payoutMethod: "/master-data/payout-methods",
  expenseCategory: "/master-data/expense-categories",
  businessUnit: "/master-data/business-units",
};

function delegateFor(model: SimpleLookupModel): SimpleLookupDelegate {
  return prisma[model] as unknown as SimpleLookupDelegate;
}

export async function createSimpleLookup(
  model: SimpleLookupModel,
  name: string
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  try {
    await delegateFor(model).create({ data: { name: trimmed } });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That name already exists." };
    }
    throw error;
  }
  revalidatePath(REVALIDATE_PATH[model]);
  return { ok: true };
}

export async function updateSimpleLookup(
  model: SimpleLookupModel,
  id: string,
  name: string
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  try {
    await delegateFor(model).update({ where: { id }, data: { name: trimmed } });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That name already exists." };
    }
    throw error;
  }
  revalidatePath(REVALIDATE_PATH[model]);
  return { ok: true };
}

export async function setSimpleLookupStatus(
  model: SimpleLookupModel,
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await delegateFor(model).update({ where: { id }, data: { status } });
  revalidatePath(REVALIDATE_PATH[model]);
  return { ok: true };
}

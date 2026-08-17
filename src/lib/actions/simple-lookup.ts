"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
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

type SimpleLookupRow = { id: string; name: string; status: string };

type SimpleLookupDelegate = {
  create(args: { data: { name: string } }): Promise<SimpleLookupRow>;
  update(args: {
    where: { id: string };
    data: { name?: string; status?: "ACTIVE" | "INACTIVE" };
  }): Promise<SimpleLookupRow>;
  findUnique(args: { where: { id: string } }): Promise<SimpleLookupRow | null>;
};

const REVALIDATE_PATH: Record<SimpleLookupModel, string> = {
  paymentMethod: "/master-data/payment-methods",
  payoutMethod: "/master-data/payout-methods",
  expenseCategory: "/master-data/expense-categories",
  businessUnit: "/master-data/business-units",
};

const ENTITY_TYPE: Record<SimpleLookupModel, string> = {
  paymentMethod: "PaymentMethod",
  payoutMethod: "PayoutMethod",
  expenseCategory: "ExpenseCategory",
  businessUnit: "BusinessUnit",
};

function delegateFor(model: SimpleLookupModel): SimpleLookupDelegate {
  return prisma[model] as unknown as SimpleLookupDelegate;
}

export async function createSimpleLookup(
  model: SimpleLookupModel,
  name: string
): Promise<ActionResult> {
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  try {
    const row = await delegateFor(model).create({ data: { name: trimmed } });
    await writeAuditLog(prisma, {
      entityType: ENTITY_TYPE[model],
      entityId: row.id,
      action: "CREATE",
      performedById: user.id,
      afterSnapshot: JSON.parse(JSON.stringify(row)),
    });
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
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  const before = await delegateFor(model).findUnique({ where: { id } });
  try {
    const row = await delegateFor(model).update({ where: { id }, data: { name: trimmed } });
    await writeAuditLog(prisma, {
      entityType: ENTITY_TYPE[model],
      entityId: id,
      action: "UPDATE",
      performedById: user.id,
      beforeSnapshot: before ? JSON.parse(JSON.stringify(before)) : undefined,
      afterSnapshot: JSON.parse(JSON.stringify(row)),
    });
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
  const user = await requireRole("OWNER", "ACCOUNTANT");
  const row = await delegateFor(model).update({ where: { id }, data: { status } });
  await writeAuditLog(prisma, {
    entityType: ENTITY_TYPE[model],
    entityId: id,
    action: "UPDATE",
    performedById: user.id,
    afterSnapshot: JSON.parse(JSON.stringify(row)),
    notes: status === "ACTIVE" ? "Activated" : "Deactivated",
  });
  revalidatePath(REVALIDATE_PATH[model]);
  return { ok: true };
}

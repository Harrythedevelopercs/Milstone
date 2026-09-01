"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { DEFAULT_FEE_BASIS_SETTING_KEY } from "@/lib/transactions/fee-basis";
import { systemSettingSchema } from "./schema";

export async function createSystemSetting(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = systemSettingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.systemSetting.create({
      data: {
        key: parsed.data.key,
        value: parsed.data.value,
        description: parsed.data.description || null,
      },
    });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That key already exists." };
    }
    throw error;
  }
  revalidatePath("/master-data/settings");
  return { ok: true };
}

export async function updateSystemSetting(key: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = systemSettingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.systemSetting.update({
    where: { key },
    data: { value: parsed.data.value, description: parsed.data.description || null },
  });
  revalidatePath("/master-data/settings");
  return { ok: true };
}

export async function deleteSystemSetting(key: string): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.systemSetting.delete({ where: { key } });
  revalidatePath("/master-data/settings");
  return { ok: true };
}

// Global default fee basis for client transactions -- last resort in the
// three-level precedence (per-transaction > per-client > this). Upserts the
// SystemSetting row directly rather than going through the generic
// create/update pair above, since this is a single well-known key with a
// dedicated UI control, not a free-form key/value entry.
export async function setDefaultFeeBasis(
  value: "GROSS" | "AFTER_MERCHANT_CHARGES"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.systemSetting.upsert({
    where: { key: DEFAULT_FEE_BASIS_SETTING_KEY },
    create: {
      key: DEFAULT_FEE_BASIS_SETTING_KEY,
      value,
      description:
        "Global default fee basis (Gross vs Net of merchant charges) for client transactions, used when neither the client nor the transaction sets an override.",
    },
    update: { value },
  });
  revalidatePath("/master-data/settings");
  revalidatePath("/transactions/new");
  return { ok: true };
}

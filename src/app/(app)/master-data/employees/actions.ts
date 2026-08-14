"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import {
  isPrismaError,
  PRISMA_UNIQUE_VIOLATION,
  type ActionResult,
} from "@/lib/action-result";
import { employeeSchema } from "./schema";

function toData(parsed: ReturnType<typeof employeeSchema.safeParse>) {
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return {
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    isEmployeePartner: parsed.data.isEmployeePartner,
    salary: parsed.data.salary || "0",
    userId: parsed.data.userId || null,
  };
}

export async function createEmployee(input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.employee.create({ data: toData(parsed) });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That user is already linked to another employee." };
    }
    throw error;
  }
  revalidatePath("/master-data/employees");
  return { ok: true };
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.employee.update({ where: { id }, data: toData(parsed) });
  } catch (error) {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
      return { ok: false, error: "That user is already linked to another employee." };
    }
    throw error;
  }
  revalidatePath("/master-data/employees");
  return { ok: true };
}

export async function setEmployeeStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  await requireRole("OWNER", "ACCOUNTANT");
  await prisma.employee.update({ where: { id }, data: { status } });
  revalidatePath("/master-data/employees");
  return { ok: true };
}

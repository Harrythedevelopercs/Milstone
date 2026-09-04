"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export type EntityHistoryEntry = {
  id: string;
  action: string;
  performedByName: string;
  performedAt: string;
  notes: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
};

// Generic counterpart to transactions/actions.ts's getTransactionHistory --
// every module's actions already call writeAuditLog with a consistent
// {entityType, entityId} (see src/lib/audit-log.ts), so this works for any
// of them without each module needing its own copy of this query.
export async function getEntityHistory(entityType: string, entityId: string): Promise<EntityHistoryEntry[]> {
  await requireRole("OWNER", "ACCOUNTANT");
  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { performedAt: "desc" },
    include: { performedBy: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    performedByName: l.performedBy.name,
    performedAt: l.performedAt.toISOString(),
    notes: l.notes,
    beforeSnapshot: l.beforeSnapshot,
    afterSnapshot: l.afterSnapshot,
  }));
}

import type { Prisma } from "@/generated/prisma/client";

export type AuditAction =
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "REQUEST_DETAILS"
  | "UPDATE_DETAILS"
  | "CREATE"
  | "CLOSE"
  | "REOPEN"
  | "MARK_SETTLED"
  | "REFUND"
  | "CHARGEBACK"
  | "VOID"
  | "UPDATE";

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    performedById: string;
    transactionId?: string;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
    notes?: string;
  }
) {
  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      performedById: params.performedById,
      transactionId: params.transactionId,
      beforeSnapshot: params.beforeSnapshot as Prisma.InputJsonValue | undefined,
      afterSnapshot: params.afterSnapshot as Prisma.InputJsonValue | undefined,
      notes: params.notes,
    },
  });
}

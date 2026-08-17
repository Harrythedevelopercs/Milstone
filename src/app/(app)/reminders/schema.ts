import { z } from "zod";

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Required"),
  note: z.string().trim().optional().or(z.literal("")),
  dueDate: z.string().trim().min(1, "Required"),
  transactionId: z.string().trim().optional().or(z.literal("")),
});

export type CreateReminderFormValues = z.infer<typeof createReminderSchema>;

export const holdTransactionSchema = z.object({
  expectedSettlementDate: z.string().trim().min(1, "Required"),
  note: z.string().trim().optional().or(z.literal("")),
});

export type HoldTransactionFormValues = z.infer<typeof holdTransactionSchema>;

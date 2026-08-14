import { z } from "zod";

export const settlementBatchSchema = z.object({
  merchantId: z.string().trim().min(1, "Required"),
  bankAccountId: z.string().trim().min(1, "Required"),
  depositDate: z.string().trim().min(1, "Required"),
  depositAmount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)), { message: "Must be a number" }),
  transactionIds: z.array(z.string()).min(1, "Select at least one transaction"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type SettlementBatchFormValues = z.infer<typeof settlementBatchSchema>;

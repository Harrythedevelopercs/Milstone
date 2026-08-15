import { z } from "zod";

export const employeeTransactionSchema = z.object({
  transactionDate: z.string().trim().min(1, "Required"),
  clientId: z.string().trim().min(1, "Required"),
  clientReference: z.string().trim().optional().or(z.literal("")),
  // Empty for a direct-to-bank payment method (no merchant involved).
  merchantId: z.string().trim().optional().or(z.literal("")),
  // Only used for direct-to-bank methods, where there's no merchant to
  // derive the settlement bank from.
  bankAccountId: z.string().trim().optional().or(z.literal("")),
  paymentMethodId: z.string().trim().min(1, "Required"),
  grossAmount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)), { message: "Must be a number" }),
  documentUrl: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type EmployeeTransactionFormValues = z.infer<typeof employeeTransactionSchema>;

import { z } from "zod";

export const employeeTransactionSchema = z.object({
  transactionDate: z.string().trim().min(1, "Required"),
  clientId: z.string().trim().min(1, "Required"),
  clientReference: z.string().trim().optional().or(z.literal("")),
  merchantId: z.string().trim().min(1, "Required"),
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

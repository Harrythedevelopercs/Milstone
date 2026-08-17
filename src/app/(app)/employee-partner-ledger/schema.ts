import { z } from "zod";

export const commissionPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
  bankAccountId: z.string().trim().min(1, "Required"),
  paymentDate: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type CommissionPaymentFormValues = z.infer<typeof commissionPaymentSchema>;

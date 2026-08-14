import { z } from "zod";

const allocationSchema = z.object({
  transactionId: z.string().trim().min(1),
  amount: z
    .string()
    .trim()
    .min(1)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
});

export const clientPayoutSchema = z.object({
  clientId: z.string().trim().min(1, "Required"),
  payoutDate: z.string().trim().min(1, "Required"),
  payoutMethodId: z.string().trim().min(1, "Required"),
  bankAccountId: z.string().trim().min(1, "Required"),
  feeBearer: z.enum(["FOUNDAPAY", "CLIENT"]),
  remittanceFee: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  reference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  allocations: z.array(allocationSchema).min(1, "Allocate the payout to at least one transaction"),
});

export type ClientPayoutFormValues = z.infer<typeof clientPayoutSchema>;

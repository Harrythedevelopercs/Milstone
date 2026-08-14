import { z } from "zod";

export const thirdPartySettlementSchema = z.object({
  settlementPartyId: z.string().trim().min(1, "Required"),
  direction: z.enum(["CLIENT_PAYABLE_TO_THIRD_PARTY", "FP_PAID_THIRD_PARTY"]),
  clientId: z.string().trim().optional().or(z.literal("")),
  bankAccountId: z.string().trim().optional().or(z.literal("")),
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
  settlementDate: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ThirdPartySettlementFormValues = z.infer<typeof thirdPartySettlementSchema>;

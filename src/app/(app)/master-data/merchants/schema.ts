import { z } from "zod";

const optionalNumber = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" })
  .optional()
  .or(z.literal(""));

export const merchantSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  companyId: z.string().trim().min(1, "Required"),
  businessUnitId: z.string().optional(),
  processor: z.string().trim().min(1, "Required"),
  settlementBankId: z.string().trim().min(1, "Required"),
  dailyLimit: optionalNumber,
  monthlyLimit: optionalNumber,
  perTxnLimit: optionalNumber,
  settlementCycle: z.string().trim().min(1, "Required"),
  defaultReservePercent: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
});

export type MerchantFormValues = z.infer<typeof merchantSchema>;

export const merchantFeeRuleSchema = z.object({
  paymentMethodId: z.string().trim().min(1, "Required"),
  feePercent: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  flatFee: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  chargebackFee: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  refundFee: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  monthlyFee: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
});

export type MerchantFeeRuleFormValues = z.infer<typeof merchantFeeRuleSchema>;

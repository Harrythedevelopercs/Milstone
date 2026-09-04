import { z } from "zod";

const decimalString = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((v) => !Number.isNaN(Number(v)), { message: "Must be a number" });

const optionalDecimalString = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" })
  .optional()
  .or(z.literal(""));

export const transactionSchema = z.object({
  transactionDate: z.string().trim().min(1, "Required"),
  clientId: z.string().trim().min(1, "Required"),
  clientReference: z.string().trim().optional().or(z.literal("")),
  // Empty for a direct-to-bank payment method (no merchant involved).
  merchantId: z.string().trim().optional().or(z.literal("")),
  expectedBankId: z.string().trim().min(1, "Required"),
  paymentMethodId: z.string().trim().min(1, "Required"),
  grossAmount: decimalString("Required"),
  feeBasis: z.enum(["GROSS", "AFTER_MERCHANT_CHARGES"]),
  chargeType: z.enum(["PERCENTAGE", "FIXED", "NONE"]),
  fixedChargeAmount: optionalDecimalString,
  feeBearer: z.enum(["FOUNDAPAY", "CLIENT"]),
  merchantFeeManual: optionalDecimalString,
  merchantReservePercent: decimalString("Required"),
  merchantReserveBasis: z.enum(["GROSS", "AFTER_MERCHANT_CHARGES"]),
  merchantReserveDirection: z.enum(["CLIENT_HELD", "FP_FRONTED", "FP_OWN"]),
  fpReservePercent: decimalString("Required"),
  documentUrl: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  customerEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Must be a valid email",
    })
    .optional()
    .or(z.literal("")),
  cardLast4: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), { message: "Must be 4 digits" })
    .optional()
    .or(z.literal("")),
}).refine((d) => d.chargeType !== "FIXED" || (d.fixedChargeAmount && d.fixedChargeAmount !== ""), {
  message: "Enter the fixed charge amount.",
  path: ["fixedChargeAmount"],
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const rcvSchema = z.object({
  transactionId: z.string().trim().min(1, "Required"),
  type: z.enum(["REFUND", "CHARGEBACK", "VOID"]),
  eventDate: z.string().trim().min(1, "Required"),
  reasonCode: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type RcvFormValues = z.infer<typeof rcvSchema>;

export const fulfillChargebackSchema = z.object({
  fulfillmentDate: z.string().trim().min(1, "Required"),
  fulfillmentBankAccountId: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type FulfillChargebackFormValues = z.infer<typeof fulfillChargebackSchema>;

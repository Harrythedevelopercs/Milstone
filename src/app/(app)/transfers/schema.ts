import { z } from "zod";

export const internalTransferSchema = z
  .object({
    fromBankAccountId: z.string().trim().min(1, "Required"),
    toBankAccountId: z.string().trim().min(1, "Required"),
    transferDate: z.string().trim().min(1, "Required"),
    amount: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
        message: "Must be a positive number",
      }),
    feeAmount: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
    feeBearer: z.enum(["FOUNDAPAY", "CLIENT"]),
    clientId: z.string().trim().optional().or(z.literal("")),
    usdValue: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => d.fromBankAccountId !== d.toBankAccountId, {
    message: "Source and destination must be different accounts",
    path: ["toBankAccountId"],
  })
  .refine((d) => d.feeBearer !== "CLIENT" || Number(d.feeAmount || 0) === 0 || !!d.clientId, {
    message: "Pick which client bears this fee.",
    path: ["clientId"],
  });

export type InternalTransferFormValues = z.infer<typeof internalTransferSchema>;

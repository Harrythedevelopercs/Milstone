import { z } from "zod";

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  accountType: z.enum(["BANK", "USDT", "CASH"]),
  bankName: z.string().trim().optional().or(z.literal("")),
  accountNumberMasked: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().min(1, "Required"),
  country: z.string().trim().optional().or(z.literal("")),
  openingBalance: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" }),
  companyId: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED", "NOT_APPLIED"]),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

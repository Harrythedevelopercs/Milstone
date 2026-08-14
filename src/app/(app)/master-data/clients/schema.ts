import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  code: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const clientRateSchema = z.object({
  paymentMethodId: z.string().trim().min(1, "Required"),
  effectiveFrom: z.string().trim().min(1, "Required"),
  ratePercent: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Must be a positive number",
    }),
  feeBasis: z.enum(["GROSS", "AFTER_MERCHANT_CHARGES"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ClientRateFormValues = z.infer<typeof clientRateSchema>;

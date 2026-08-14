import { z } from "zod";

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
});

export type VendorFormValues = z.infer<typeof vendorSchema>;

export const vendorSubscriptionSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Must be a positive number",
    }),
  billingCycle: z.string().trim().min(1, "Required"),
  nextBillingDate: z.string().trim().optional().or(z.literal("")),
});

export type VendorSubscriptionFormValues = z.infer<typeof vendorSubscriptionSchema>;

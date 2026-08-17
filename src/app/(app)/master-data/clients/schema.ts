import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  code: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  // Default reserve handling for this client's transactions -- "" means no
  // default (custom every time). Always overridable per transaction.
  defaultReserveType: z.enum(["PERCENT", "FIXED", ""]),
  defaultReserveValue: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), { message: "Must be a positive number" }),
  defaultReserveDirection: z.enum(["CLIENT_HELD", "FP_FRONTED", "FP_OWN", ""]),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

// One row per payment method; ratePercent left as "" means "no rate set for
// this method" (not zero) -- the rate lookup already treats a missing rate
// as a hard stop when a transaction tries to use that method.
const clientRateEntrySchema = z.object({
  paymentMethodId: z.string().trim().min(1),
  ratePercent: z
    .string()
    .trim()
    .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: "Must be a positive number",
    }),
  feeBasis: z.enum(["GROSS", "AFTER_MERCHANT_CHARGES"]),
});

export const clientRateBatchSchema = z
  .object({
    effectiveFrom: z.string().trim().min(1, "Required"),
    entries: z.array(clientRateEntrySchema),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => d.entries.some((e) => e.ratePercent.trim() !== ""), {
    message: "Enter a rate for at least one payment method.",
    path: ["entries"],
  });

export type ClientRateBatchFormValues = z.infer<typeof clientRateBatchSchema>;

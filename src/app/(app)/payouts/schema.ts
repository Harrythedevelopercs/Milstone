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

// Split from the refined schema below so the form's resolver can still call
// `.omit({ allocations: true })` on it -- `.omit()` isn't supported on a
// ZodEffects (the wrapper `.refine()` produces). The form validates the
// allocations-or-generalAmount rule itself client-side (it doesn't manage
// `allocations` as an RHF field at all); the refine below is what actually
// enforces it server-side in `createClientPayout`.
export const clientPayoutBaseSchema = z.object({
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
  allocations: z.array(allocationSchema),
  // Portion not tied to any specific transaction -- can be combined with
  // allocations in the same payout, or used entirely on its own.
  generalAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" })
    .optional()
    .or(z.literal("")),
});

export const clientPayoutSchema = clientPayoutBaseSchema.refine(
  (d) => d.allocations.length > 0 || (d.generalAmount && Number(d.generalAmount) > 0),
  {
    message: "Allocate to at least one transaction or enter a general amount.",
    path: ["generalAmount"],
  }
);

export type ClientPayoutFormValues = z.infer<typeof clientPayoutSchema>;

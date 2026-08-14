import { z } from "zod";

export const reconciliationSchema = z.object({
  asOfDate: z.string().trim().min(1, "Required"),
  actualBalance: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)), { message: "Must be a number" }),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ReconciliationFormValues = z.infer<typeof reconciliationSchema>;

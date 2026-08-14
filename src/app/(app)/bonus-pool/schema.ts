import { z } from "zod";

export const bonusAllocationSchema = z.object({
  employeeId: z.string().trim().min(1, "Required"),
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
  allocationDate: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type BonusAllocationFormValues = z.infer<typeof bonusAllocationSchema>;

import { z } from "zod";

export const drawingSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
  bankAccountId: z.string().trim().min(1, "Required"),
  drawingDate: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type DrawingFormValues = z.infer<typeof drawingSchema>;

import { z } from "zod";

export const clientBehalfExpenseSchema = z.object({
  clientId: z.string().trim().min(1, "Required"),
  bankAccountId: z.string().trim().min(1, "Required"),
  amount: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Must be a positive number",
    }),
  expenseDate: z.string().trim().min(1, "Required"),
  description: z.string().trim().min(1, "Required"),
});

export type ClientBehalfExpenseFormValues = z.infer<typeof clientBehalfExpenseSchema>;

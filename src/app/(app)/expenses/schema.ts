import { z } from "zod";

export const expenseSchema = z
  .object({
    expenseCategoryId: z.string().trim().min(1, "Required"),
    vendorId: z.string().optional(),
    subscriptionId: z.string().optional(),
    companyId: z.string().optional(),
    businessUnitId: z.string().optional(),
    bankAccountId: z.string().trim().min(1, "Required"),
    amount: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
        message: "Must be a positive number",
      }),
    expenseDate: z.string().trim().min(1, "Required"),
    description: z.string().trim().optional().or(z.literal("")),
    recurring: z.boolean(),
    nextBillingDate: z.string().trim().optional().or(z.literal("")),
    documentUrl: z.string().trim().optional().or(z.literal("")),
    feeBearer: z.enum(["FOUNDAPAY", "CLIENT"]),
    clientId: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => d.feeBearer !== "CLIENT" || !!d.clientId, {
    message: "Pick which client bears this expense.",
    path: ["clientId"],
  });

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

import { z } from "zod";

export const accountSchema = z.object({
  code: z.string().trim().min(1, "Required"),
  name: z.string().trim().min(1, "Required"),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"]),
  description: z.string().trim().optional().or(z.literal("")),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

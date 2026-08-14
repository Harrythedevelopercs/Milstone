import { z } from "zod";

export const productServiceSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  cost: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Must be a positive number",
    }),
  sellPrice: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
      message: "Must be a positive number",
    }),
});

export type ProductServiceFormValues = z.infer<typeof productServiceSchema>;

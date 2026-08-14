import { z } from "zod";

export const productServiceSaleSchema = z.object({
  productServiceId: z.string().trim().min(1, "Required"),
  clientId: z.string().optional(),
  businessUnitId: z.string().optional(),
  quantity: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, {
      message: "Must be a whole number greater than 0",
    }),
  unitCost: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, { message: "Must be a number" }),
  unitSellPrice: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, { message: "Must be a number" }),
  saleDate: z.string().trim().min(1, "Required"),
  deductFromClientBalance: z.boolean(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ProductServiceSaleFormValues = z.infer<typeof productServiceSaleSchema>;

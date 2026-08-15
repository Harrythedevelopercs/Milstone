import { z } from "zod";

export const paymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  requiresMerchant: z.boolean(),
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;

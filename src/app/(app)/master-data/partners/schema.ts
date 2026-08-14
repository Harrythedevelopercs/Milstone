import { z } from "zod";

export const partnerSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  profitSharePercent: z
    .string()
    .trim()
    .min(1, "Required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100, {
      message: "Must be a number between 0 and 100",
    }),
  userId: z.string().optional(),
});

export type PartnerFormValues = z.infer<typeof partnerSchema>;

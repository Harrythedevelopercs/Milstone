import { z } from "zod";

export const referralPartnerSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ReferralPartnerFormValues = z.infer<typeof referralPartnerSchema>;

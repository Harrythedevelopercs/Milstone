import { z } from "zod";

export const settlementPartySchema = z.object({
  name: z.string().trim().min(1, "Required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type SettlementPartyFormValues = z.infer<typeof settlementPartySchema>;

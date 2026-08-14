import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(1, "Required"),
  legalName: z.string().trim().optional().or(z.literal("")),
  partnerId: z.string().trim().min(1, "Required"),
});

export type CompanyFormValues = z.infer<typeof companySchema>;

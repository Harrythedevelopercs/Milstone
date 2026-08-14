import { z } from "zod";

const monthPattern = /^\d{4}-\d{2}$/;

export const runPayrollSchema = z.object({
  accountingMonth: z.string().regex(monthPattern, "Pick a month"),
  bankAccountId: z.string().trim().min(1, "Required"),
  paymentDate: z.string().trim().min(1, "Required"),
});
export type RunPayrollFormValues = z.infer<typeof runPayrollSchema>;

export const runEpCommissionsSchema = z.object({
  accountingMonth: z.string().regex(monthPattern, "Pick a month"),
  runDate: z.string().trim().min(1, "Required"),
});
export type RunEpCommissionsFormValues = z.infer<typeof runEpCommissionsSchema>;

export const runPartnerDistributionSchema = z.object({
  accountingMonth: z.string().regex(monthPattern, "Pick a month"),
  runDate: z.string().trim().min(1, "Required"),
});
export type RunPartnerDistributionFormValues = z.infer<typeof runPartnerDistributionSchema>;

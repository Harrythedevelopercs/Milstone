import { z } from "zod";

export const systemSettingSchema = z.object({
  key: z.string().trim().min(1, "Required"),
  value: z.string().trim().min(1, "Required"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type SystemSettingFormValues = z.infer<typeof systemSettingSchema>;

import { z } from "zod";

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  isEmployeePartner: z.boolean(),
  salary: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Must be a number" })
    .optional()
    .or(z.literal("")),
  userId: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

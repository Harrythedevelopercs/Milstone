import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type AppRole = "OWNER" | "ACCOUNTANT" | "EMPLOYEE";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: AppRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

// Owner + Accountant have full operational/ledger access; Employees only see
// their own submissions (brief section 3).
export const CAN_VIEW_ECONOMICS: AppRole[] = ["OWNER", "ACCOUNTANT"];
export const CAN_APPROVE_TRANSACTIONS: AppRole[] = ["OWNER", "ACCOUNTANT"];
export const CAN_CLOSE_MONTH: AppRole[] = ["OWNER", "ACCOUNTANT"];
export const CAN_REOPEN_MONTH: AppRole[] = ["OWNER"];

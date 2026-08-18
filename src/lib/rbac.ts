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

// Employees have the same full access as Owner across the whole app
// (decision reversed from the original "employees only see their own
// submissions" brief) -- every requireRole(...) call, regardless of which
// roles it lists, passes for EMPLOYEE too, so this one check is the single
// point of truth instead of touching each of the ~50 call sites.
export async function requireRole(...roles: AppRole[]) {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE" && !roles.includes(user.role)) redirect("/");
  return user;
}

export const CAN_VIEW_ECONOMICS: AppRole[] = ["OWNER", "ACCOUNTANT", "EMPLOYEE"];
export const CAN_APPROVE_TRANSACTIONS: AppRole[] = ["OWNER", "ACCOUNTANT", "EMPLOYEE"];
export const CAN_CLOSE_MONTH: AppRole[] = ["OWNER", "ACCOUNTANT", "EMPLOYEE"];
export const CAN_REOPEN_MONTH: AppRole[] = ["OWNER", "EMPLOYEE"];

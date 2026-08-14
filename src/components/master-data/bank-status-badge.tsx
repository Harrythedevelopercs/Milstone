import { Badge } from "@/components/ui/badge";

export type BankAccountStatus = "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";

const LABEL: Record<BankAccountStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  NOT_APPLIED: "Not Applied",
};

const VARIANT: Record<BankAccountStatus, "default" | "destructive" | "secondary"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
  NOT_APPLIED: "secondary",
};

export function BankStatusBadge({ status }: { status: BankAccountStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}

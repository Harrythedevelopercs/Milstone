import { ToneBadge } from "@/components/ui/tone-badge";
import { statusTone } from "@/lib/status-tone";

export type BankAccountStatus = "ACTIVE" | "SUSPENDED" | "NOT_APPLIED";

const LABEL: Record<BankAccountStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  NOT_APPLIED: "Not Applied",
};

export function BankStatusBadge({ status }: { status: BankAccountStatus }) {
  return <ToneBadge tone={statusTone.bank(status)}>{LABEL[status]}</ToneBadge>;
}

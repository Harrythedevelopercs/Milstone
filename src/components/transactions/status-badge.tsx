import { ToneBadge } from "@/components/ui/tone-badge";
import { statusTone } from "@/lib/status-tone";

const LABEL: Record<string, string> = {
  DETAILS_REQUESTED: "Details Requested",
  CLIENT_PAYABLE: "Client Payable",
  PARTIALLY_PAID: "Partially Paid",
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return (
    <ToneBadge tone={statusTone.transaction(status)}>
      {LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </ToneBadge>
  );
}

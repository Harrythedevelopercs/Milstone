import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ENTERED: "outline",
  SUBMITTED: "secondary",
  DETAILS_REQUESTED: "secondary",
  APPROVED: "default",
  PROCESSED: "default",
  SETTLED: "default",
  CLIENT_PAYABLE: "default",
  PARTIALLY_PAID: "default",
  PAID: "default",
  CLOSED: "outline",
  HOLD: "secondary",
  RESERVE: "secondary",
  VOID: "destructive",
  REFUNDED: "destructive",
  CHARGEBACK: "destructive",
  DISPUTED: "destructive",
  REJECTED: "destructive",
};

const LABEL: Record<string, string> = {
  DETAILS_REQUESTED: "Details Requested",
  CLIENT_PAYABLE: "Client Payable",
  PARTIALLY_PAID: "Partially Paid",
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={VARIANT[status] ?? "outline"}>
      {LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

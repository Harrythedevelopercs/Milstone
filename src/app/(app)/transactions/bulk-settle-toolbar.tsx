"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrudAction } from "@/hooks/use-crud-action";
import { markAllSettled } from "./actions";

export function BulkSettleToolbar({
  merchants,
}: {
  merchants: { id: string; name: string }[];
}) {
  const { run, isPending } = useCrudAction();
  const [merchantId, setMerchantId] = useState("");
  const [day, setDay] = useState("");
  const [settlementDate, setSettlementDate] = useState(format(new Date(), "yyyy-MM-dd"));

  function submit() {
    run(
      async () => {
        const result = await markAllSettled({
          merchantId: merchantId || null,
          day: day || null,
          settlementDate,
        });
        if (result.ok) {
          toast.success(`Marked ${result.count} transaction${result.count === 1 ? "" : "s"} settled`);
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Merchant</label>
        <Select
          value={merchantId || "any"}
          onValueChange={(v) => setMerchantId(!v || v === "any" ? "" : v)}
          items={[{ value: "any", label: "Any merchant" }, ...merchants.map((m) => ({ value: m.id, label: m.name }))]}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Any merchant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any merchant</SelectItem>
            {merchants.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Transaction day</label>
        <Input type="date" className="w-40" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Settled date</label>
        <Input
          type="date"
          className="w-40"
          value={settlementDate}
          onChange={(e) => setSettlementDate(e.target.value)}
        />
      </div>
      <Button
        variant="outline"
        onClick={submit}
        disabled={isPending || (!merchantId && !day)}
      >
        {isPending ? "Marking..." : "Mark all settled"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Applies to Approved transactions only. Pick a merchant and/or a day so this never
        touches everything at once.
      </p>
    </div>
  );
}

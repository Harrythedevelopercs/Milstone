"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setDefaultFeeBasis } from "./actions";

const FEE_BASIS_ITEMS = [
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
];

export function DefaultFeeBasisPanel({
  value: initialValue,
}: {
  value: "GROSS" | "AFTER_MERCHANT_CHARGES";
}) {
  const [value, setValue] = useState<"GROSS" | "AFTER_MERCHANT_CHARGES">(initialValue);
  const { run, isPending } = useCrudAction();

  function save() {
    run(() => setDefaultFeeBasis(value), { successMessage: "Default fee basis updated" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Fee Basis</CardTitle>
        <CardDescription>
          The global default for whether FoundaPay&apos;s fee and a client&apos;s net payout are
          calculated on the gross amount or net of merchant charges. Applies to client
          transactions only -- internal transactions are unaffected. Used only when neither the
          client (Master Data → Clients) nor the transaction itself sets an override; both of
          those always take priority over this.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="w-72">
          <Select
            value={value}
            onValueChange={(v) => setValue(v as "GROSS" | "AFTER_MERCHANT_CHARGES")}
            items={FEE_BASIS_ITEMS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEE_BASIS_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

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
import { setDefaultMerchantReserveBasis } from "./actions";

const RESERVE_BASIS_ITEMS = [
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
];

export function DefaultMerchantReserveBasisPanel({
  value: initialValue,
}: {
  value: "GROSS" | "AFTER_MERCHANT_CHARGES";
}) {
  const [value, setValue] = useState<"GROSS" | "AFTER_MERCHANT_CHARGES">(initialValue);
  const { run, isPending } = useCrudAction();

  function save() {
    run(() => setDefaultMerchantReserveBasis(value), { successMessage: "Default merchant reserve basis updated" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Merchant Reserve Basis</CardTitle>
        <CardDescription>
          The global default for whether the merchant reserve % is calculated on the gross
          amount or net of merchant charges. Applies to client transactions only. Used only when
          neither the client (Master Data → Clients) nor the transaction itself sets an
          override; both of those always take priority over this.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="w-72">
          <Select
            value={value}
            onValueChange={(v) => setValue(v as "GROSS" | "AFTER_MERCHANT_CHARGES")}
            items={RESERVE_BASIS_ITEMS}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESERVE_BASIS_ITEMS.map((i) => (
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

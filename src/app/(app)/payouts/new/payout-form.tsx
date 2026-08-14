"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import { clientPayoutSchema, type ClientPayoutFormValues } from "../schema";
import { createClientPayout } from "../actions";

export type Option = { id: string; name: string };
export type PayableTransaction = { id: string; clientId: string; remaining: string };

const FEE_BEARER_ITEMS = [
  { value: "FOUNDAPAY", label: "FoundaPay" },
  { value: "CLIENT", label: "Client" },
];

export function PayoutForm({
  clients,
  payoutMethods,
  bankAccounts,
  payableTransactions,
}: {
  clients: Option[];
  payoutMethods: Option[];
  bankAccounts: Option[];
  payableTransactions: PayableTransaction[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const form = useForm<Omit<ClientPayoutFormValues, "allocations">>({
    resolver: zodResolver(clientPayoutSchema.omit({ allocations: true })),
    defaultValues: {
      clientId: "",
      payoutDate: format(new Date(), "yyyy-MM-dd"),
      payoutMethodId: "",
      bankAccountId: "",
      feeBearer: "CLIENT",
      remittanceFee: "0",
      reference: "",
      notes: "",
    },
  });

  const clientId = form.watch("clientId");
  const clientTransactions = useMemo(
    () => payableTransactions.filter((t) => t.clientId === clientId),
    [payableTransactions, clientId]
  );

  function toggle(id: string, remaining: string, checked: boolean) {
    setSelected((s) => ({ ...s, [id]: checked }));
    if (checked && !amounts[id]) {
      setAmounts((a) => ({ ...a, [id]: remaining }));
    }
  }

  const totalAllocated = clientTransactions
    .filter((t) => selected[t.id])
    .reduce((sum, t) => sum.plus(amounts[t.id] || "0"), new Decimal(0));

  function onSubmit(values: Omit<ClientPayoutFormValues, "allocations">) {
    const allocations = clientTransactions
      .filter((t) => selected[t.id])
      .map((t) => ({ transactionId: t.id, amount: amounts[t.id] || "0" }));

    if (allocations.length === 0) {
      setAllocationError("Select at least one transaction to pay out.");
      return;
    }
    setAllocationError(null);

    run(
      async () => {
        const result = await createClientPayout({ ...values, allocations });
        if (result.ok) {
          toast.success("Payout recorded");
          router.push("/payouts");
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Client Payout</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setSelected({});
                      setAmounts({});
                    }}
                    items={clients.map((c) => ({ value: c.id, label: c.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {clientId && (
              <div className="space-y-2">
                <FormLabel>Transactions to pay</FormLabel>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {clientTransactions.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No payable transactions for this client.
                    </p>
                  ) : (
                    clientTransactions.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!selected[t.id]}
                            onCheckedChange={(checked) => toggle(t.id, t.remaining, !!checked)}
                          />
                          <span className="font-mono text-xs">{t.id}</span>
                          <span className="text-muted-foreground">
                            (remaining {t.remaining})
                          </span>
                        </div>
                        {selected[t.id] && (
                          <Input
                            type="number"
                            step="0.01"
                            className="w-28"
                            value={amounts[t.id] ?? t.remaining}
                            onChange={(e) =>
                              setAmounts((a) => ({ ...a, [t.id]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total allocated: {totalAllocated.toFixed(2)}
                </p>
                {allocationError && <p className="text-sm text-destructive">{allocationError}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payoutDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payout date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payoutMethodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payout method</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={payoutMethods.map((m) => ({ value: m.id, label: m.name }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {payoutMethods.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid from</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={bankAccounts.map((b) => ({ value: b.id, label: b.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a bank account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="feeBearer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remittance fee bearer</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={FEE_BEARER_ITEMS}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FOUNDAPAY">FoundaPay</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remittanceFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remittance fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Record Payout"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

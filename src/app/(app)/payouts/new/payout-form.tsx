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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import { clientPayoutBaseSchema, type ClientPayoutFormValues } from "../schema";
import { createClientPayout } from "../actions";
import type { PayoutClientOption, PayableTransaction } from "@/lib/transactions/payable-data";

export type Option = { id: string; name: string };
export type { PayableTransaction };

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
  clients: PayoutClientOption[];
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
    resolver: zodResolver(clientPayoutBaseSchema.omit({ allocations: true })),
    defaultValues: {
      clientId: "",
      payoutDate: format(new Date(), "yyyy-MM-dd"),
      payoutMethodId: "",
      bankAccountId: "",
      feeBearer: "CLIENT",
      remittanceFee: "0",
      reference: "",
      notes: "",
      generalAmount: "",
    },
  });

  const clientId = form.watch("clientId");
  const clientTransactions = useMemo(
    () => payableTransactions.filter((t) => t.clientId === clientId),
    [payableTransactions, clientId]
  );
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  function toggle(id: string, remaining: string, checked: boolean) {
    setSelected((s) => ({ ...s, [id]: checked }));
    if (checked && !amounts[id]) {
      setAmounts((a) => ({ ...a, [id]: remaining }));
    }
  }

  const generalAmountValue = form.watch("generalAmount");
  const totalAllocated = clientTransactions
    .filter((t) => selected[t.id])
    .reduce((sum, t) => sum.plus(amounts[t.id] || "0"), new Decimal(0));
  const generalAmountDecimal = generalAmountValue ? new Decimal(generalAmountValue || "0") : new Decimal(0);
  const grandTotal = totalAllocated.plus(generalAmountDecimal);

  const balanceAfter = selectedClient
    ? new Decimal(selectedClient.currentBalance).minus(grandTotal)
    : null;

  function onSubmit(values: Omit<ClientPayoutFormValues, "allocations">) {
    const allocations = clientTransactions
      .filter((t) => selected[t.id])
      .map((t) => ({ transactionId: t.id, amount: amounts[t.id] || "0" }));

    if (allocations.length === 0 && !(values.generalAmount && Number(values.generalAmount) > 0)) {
      setAllocationError("Select at least one transaction, or enter a general amount, to pay out.");
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
                  <FormLabel hint="Which client you're paying. Their current balance, payable transactions, and total owed all update below once selected.">Client</FormLabel>
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
                <FormLabel hint="Check the transactions this payout settles. Each defaults to its full remaining balance, but you can edit the amount per transaction -- paying more than what's remaining adds to the client's advance.">Transactions to pay</FormLabel>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {clientTransactions.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No payable transactions for this client.
                    </p>
                  ) : (
                    clientTransactions.map((t) => {
                      const overRemaining =
                        selected[t.id] &&
                        new Decimal(amounts[t.id] || "0").greaterThan(
                          new Decimal(t.remaining).plus(0.01)
                        );
                      return (
                        <div
                          key={t.id}
                          className="flex flex-col gap-1 border-b px-3 py-2 text-sm last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-3">
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
                          {overRemaining && (
                            <p className="pl-6 text-xs text-amber-600">
                              This exceeds the transaction&apos;s remaining balance — paying it
                              will add to the client&apos;s advance.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total allocated to transactions: {totalAllocated.toFixed(2)}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="generalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="A payout amount that isn't tied to any specific transaction -- e.g. a general advance or a catch-up payment. Combine it with allocations above, or use it entirely on its own.">General amount (optional, not tied to a transaction)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" min="0" placeholder="0.00" />
                  </FormControl>
                  <FormDescription>
                    Can be combined with the transaction allocations above, or used entirely on
                    its own -- e.g. a general advance or a catch-up payment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {clientId && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">
                  Total this payout: {grandTotal.toFixed(2)}
                </p>
                {selectedClient && (
                  <p className="text-sm text-muted-foreground">
                    {selectedClient.name}&apos;s current balance: {selectedClient.currentBalance}
                  </p>
                )}
                {balanceAfter && (
                  <p className="text-sm text-muted-foreground">
                    Balance after this payout: {balanceAfter.toFixed(2)}
                  </p>
                )}
                {balanceAfter && balanceAfter.lessThan(0) && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    This payout will result in an advance of{" "}
                    <strong>{balanceAfter.abs().toFixed(2)}</strong> — {selectedClient?.name}{" "}
                    will owe FoundaPay back. This will be tracked on the client statement.
                  </p>
                )}
                {allocationError && <p className="text-sm text-destructive">{allocationError}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payoutDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this payout was actually sent to the client.">Payout date</FormLabel>
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
                    <FormLabel hint="How the money was sent to the client (e.g. Wire, ACH, USDT).">Payout method</FormLabel>
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
                  <FormLabel hint="Which of FoundaPay's accounts the payout goes out of -- a bank account, a USDT wallet, or cash position. Paying from cash doesn't touch any bank balance.">Paid from</FormLabel>
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
                    <FormLabel hint="Who absorbs the cost of sending this payout. FoundaPay: it's FP's own cost. Client: it's deducted from the client's balance.">Remittance fee bearer</FormLabel>
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
                    <FormLabel hint="What the payout method (wire/bank) charged to send this money, if anything.">Remittance fee</FormLabel>
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
                  <FormLabel hint="Optional -- a wire/transfer confirmation number or other reference for this payout.">Reference</FormLabel>
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
                  <FormLabel hint="Optional -- any free-text context worth keeping with this payout.">Notes</FormLabel>
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

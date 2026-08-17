"use client";

import { useEffect, useMemo } from "react";
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
import { settlementBatchSchema, type SettlementBatchFormValues } from "../schema";
import { createSettlementBatch, updateSettlementBatch } from "../actions";

export type Option = { id: string; name: string };
export type MerchantOption = { id: string; name: string; settlementBankId: string };
export type UnsettledTransaction = {
  id: string;
  merchantId: string;
  clientName: string;
  paymentMethodName: string;
  grossAmount: string;
  expectedSettlement: string;
  locked?: boolean;
  lockedReason?: string;
};

export function SettlementForm({
  merchants,
  unsettledTransactions,
  editingId,
  defaultValues: providedDefaultValues,
  onSuccess,
  hideChrome = false,
}: {
  merchants: MerchantOption[];
  editingId?: string;
  defaultValues?: SettlementBatchFormValues;
  onSuccess?: () => void;
  hideChrome?: boolean;
  unsettledTransactions: UnsettledTransaction[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<SettlementBatchFormValues>({
    resolver: zodResolver(settlementBatchSchema),
    defaultValues: providedDefaultValues ?? {
      merchantId: "",
      bankAccountId: "",
      depositDate: format(new Date(), "yyyy-MM-dd"),
      depositAmount: "",
      transactionIds: [],
      notes: "",
    },
  });

  const merchantId = form.watch("merchantId");
  const selectedIds = form.watch("transactionIds");
  const depositAmount = form.watch("depositAmount");

  // Silent, like the transaction form: a batch always deposits into the
  // merchant's configured settlement bank, never a manually-picked one.
  useEffect(() => {
    const merchant = merchants.find((m) => m.id === merchantId);
    if (merchant) form.setValue("bankAccountId", merchant.settlementBankId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const merchantTransactions = useMemo(
    () => unsettledTransactions.filter((t) => t.merchantId === merchantId),
    [unsettledTransactions, merchantId]
  );

  const expectedTotal = useMemo(
    () =>
      merchantTransactions
        .filter((t) => selectedIds.includes(t.id))
        .reduce((sum, t) => sum.plus(t.expectedSettlement), new Decimal(0)),
    [merchantTransactions, selectedIds]
  );

  const difference =
    depositAmount && !Number.isNaN(Number(depositAmount))
      ? new Decimal(depositAmount).minus(expectedTotal)
      : null;

  function toggleTransaction(id: string, checked: boolean, locked?: boolean) {
    if (locked) return;
    const current = form.getValues("transactionIds");
    form.setValue(
      "transactionIds",
      checked ? [...current, id] : current.filter((x) => x !== id)
    );
  }

  function onSubmit(values: SettlementBatchFormValues) {
    run(
      async () => {
        const result = editingId
          ? await updateSettlementBatch(editingId, values)
          : await createSettlementBatch(values);
        if (result.ok) {
          toast.success(editingId ? "Settlement batch updated" : "Settlement batch created");
          if (editingId) {
            onSuccess?.();
          } else {
            router.push("/settlements");
          }
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  const formBody = (
    <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Bank is always the merchant's configured settlement bank,
                silently -- nothing to pick or see here. */}
            <FormField
              control={form.control}
              name="merchantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which merchant this deposit settles. Its configured settlement bank is used automatically.">Merchant{editingId ? " (locked)" : ""}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("transactionIds", []);
                    }}
                    items={merchants.map((m) => ({ value: m.id, label: m.name }))}
                    disabled={!!editingId}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a merchant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {merchants.map((m) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="depositDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this deposit actually landed in the bank.">Deposit date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="What actually landed in the bank -- compared against the expected total of the transactions checked below to catch any difference.">Actual deposit amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {merchantId && (
              <div className="space-y-2">
                <FormLabel hint="Check every approved transaction this deposit is settling. Their expected-settlement total is compared against the actual deposit amount above.">Transactions covered by this deposit</FormLabel>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {merchantTransactions.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No unsettled approved transactions for this merchant.
                    </p>
                  ) : (
                    merchantTransactions.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedIds.includes(t.id)}
                            disabled={t.locked}
                            onCheckedChange={(checked) => toggleTransaction(t.id, !!checked, t.locked)}
                          />
                          <span className="font-mono text-xs">{t.id}</span>
                          <span className="text-muted-foreground">
                            {t.clientName} · {t.paymentMethodName}
                          </span>
                          {t.locked && (
                            <span className="text-xs text-muted-foreground">({t.lockedReason})</span>
                          )}
                        </div>
                        <span>{t.expectedSettlement}</span>
                      </label>
                    ))
                  )}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Expected total: {expectedTotal.toFixed(2)}</span>
                  {difference !== null && (
                    <span className={!difference.isZero() ? "text-destructive font-medium" : ""}>
                      Difference: {difference.toFixed(2)}
                    </span>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="transactionIds"
                  render={() => <FormMessage />}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Optional -- any context for this settlement batch.">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : editingId ? "Save Changes" : "Create Settlement Batch"}
            </Button>
          </form>
    </Form>
  );

  if (hideChrome) return formBody;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Settlement Batch</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}

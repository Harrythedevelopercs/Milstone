"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DataTable } from "@/components/master-data/data-table";
import { useCrudAction } from "@/hooks/use-crud-action";
import { merchantFeeRuleSchema, type MerchantFeeRuleFormValues } from "./schema";
import { upsertMerchantFeeRule } from "./actions";

export type FeeRuleRow = {
  id: string;
  paymentMethodId: string;
  feePercent: string;
  flatFee: string;
  chargebackFee: string;
  refundFee: string;
  monthlyFee: string;
  paymentMethod: { name: string };
};

export function FeeRulesPanel({
  merchantId,
  rules,
  paymentMethods,
}: {
  merchantId: string;
  rules: FeeRuleRow[];
  paymentMethods: { id: string; name: string }[];
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<MerchantFeeRuleFormValues>({
    resolver: zodResolver(merchantFeeRuleSchema),
    defaultValues: {
      paymentMethodId: "",
      feePercent: "0",
      flatFee: "0",
      chargebackFee: "0",
      refundFee: "0",
      monthlyFee: "0",
    },
  });

  function loadExisting(paymentMethodId: string | null) {
    if (!paymentMethodId) return;
    const existing = rules.find((r) => r.paymentMethodId === paymentMethodId);
    form.reset({
      paymentMethodId,
      feePercent: existing?.feePercent ?? "0",
      flatFee: existing?.flatFee ?? "0",
      chargebackFee: existing?.chargebackFee ?? "0",
      refundFee: existing?.refundFee ?? "0",
      monthlyFee: existing?.monthlyFee ?? "0",
    });
  }

  function onSubmit(values: MerchantFeeRuleFormValues) {
    run(() => upsertMerchantFeeRule(merchantId, values), {
      successMessage: "Fee rule saved",
    });
  }

  return (
    <div className="space-y-6">
      <DataTable
        rows={rules}
        rowKey={(r) => r.id}
        emptyMessage="No fee rules set yet."
        columns={[
          { key: "method", header: "Method", render: (r) => r.paymentMethod.name },
          { key: "fee", header: "Fee %", render: (r) => r.feePercent },
          { key: "flat", header: "Flat Fee", render: (r) => r.flatFee },
          { key: "cb", header: "Chargeback Fee", render: (r) => r.chargebackFee },
          { key: "refund", header: "Refund Fee", render: (r) => r.refundFee },
          { key: "monthly", header: "Monthly Fee", render: (r) => r.monthlyFee },
        ]}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Add or update a fee rule</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which payment method this fee rule applies to. Picking one that already has a rule loads its current values for editing.">Payment method</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      loadExisting(v);
                    }}
                    items={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentMethods.map((m) => (
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
                name="feePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The processor's percentage fee for this payment method -- used as the default merchant fee on new transactions.">Fee %</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="flatFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="A fixed per-transaction fee, in addition to the percentage above.">Flat fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chargebackFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="What the processor charges when a chargeback happens on this payment method, for reference.">Chargeback fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="refundFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="What the processor charges when a refund happens on this payment method, for reference.">Refund fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthlyFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="A recurring monthly fee this processor charges for this payment method, for reference.">Monthly fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Save fee rule"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

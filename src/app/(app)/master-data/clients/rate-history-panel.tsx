"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { clientRateSchema, type ClientRateFormValues } from "./schema";
import { addClientRate } from "./actions";

export type RateHistoryRow = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  ratePercent: string;
  feeBasis: "GROSS" | "AFTER_MERCHANT_CHARGES";
  paymentMethod: { name: string };
};

const FEE_BASIS_LABEL: Record<string, string> = {
  GROSS: "Gross",
  AFTER_MERCHANT_CHARGES: "After Merchant Charges",
};

export function RateHistoryPanel({
  clientId,
  rates,
  paymentMethods,
}: {
  clientId: string;
  rates: RateHistoryRow[];
  paymentMethods: { id: string; name: string }[];
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<ClientRateFormValues>({
    resolver: zodResolver(clientRateSchema),
    defaultValues: {
      paymentMethodId: "",
      effectiveFrom: format(new Date(), "yyyy-MM-dd"),
      ratePercent: "",
      feeBasis: "GROSS",
      notes: "",
    },
  });

  function onSubmit(values: ClientRateFormValues) {
    run(() => addClientRate(clientId, values), {
      successMessage: "Rate added",
      onSuccess: () =>
        form.reset({
          paymentMethodId: "",
          effectiveFrom: format(new Date(), "yyyy-MM-dd"),
          ratePercent: "",
          feeBasis: "GROSS",
          notes: "",
        }),
    });
  }

  return (
    <div className="space-y-6">
      <DataTable
        rows={rates}
        rowKey={(r) => r.id}
        emptyMessage="No rate history yet."
        columns={[
          { key: "method", header: "Method", render: (r) => r.paymentMethod.name },
          { key: "rate", header: "Rate", render: (r) => `${r.ratePercent}%` },
          { key: "basis", header: "Basis", render: (r) => FEE_BASIS_LABEL[r.feeBasis] },
          { key: "from", header: "From", render: (r) => r.effectiveFrom },
          { key: "to", header: "To", render: (r) => r.effectiveTo ?? "current" },
        ]}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Add new rate period</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
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
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective from</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ratePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate %</FormLabel>
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
              name="feeBasis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee basis</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={[
                      { value: "GROSS", label: "Gross" },
                      { value: "AFTER_MERCHANT_CHARGES", label: "After Merchant Charges" },
                    ]}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GROSS">Gross</SelectItem>
                      <SelectItem value="AFTER_MERCHANT_CHARGES">
                        After Merchant Charges
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
              {isPending ? "Saving..." : "Add rate"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

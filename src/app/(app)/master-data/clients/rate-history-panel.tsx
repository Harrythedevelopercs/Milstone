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
import { FieldHint } from "@/components/ui/field-hint";
import { useCrudAction } from "@/hooks/use-crud-action";
import { clientRateBatchSchema, type ClientRateBatchFormValues } from "./schema";
import { saveClientRateBatch } from "./actions";

export type RateHistoryRow = {
  id: string;
  paymentMethodId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  ratePercent: string;
  feeBasis: "GROSS" | "AFTER_MERCHANT_CHARGES";
  referralPartnerId: string | null;
  referralPartnerRatePercent: string | null;
  paymentMethod: { name: string };
  referralPartner: { name: string } | null;
};

const FEE_BASIS_LABEL: Record<string, string> = {
  GROSS: "Gross",
  AFTER_MERCHANT_CHARGES: "After Merchant Charges",
};

const FEE_BASIS_ITEMS = [
  { value: "GROSS", label: "Gross" },
  { value: "AFTER_MERCHANT_CHARGES", label: "After Merchant Charges" },
];

const NO_REFERRAL_PARTNER = "none";

export function RateHistoryPanel({
  clientId,
  rates,
  paymentMethods,
  referralPartners,
}: {
  clientId: string;
  rates: RateHistoryRow[];
  paymentMethods: { id: string; name: string }[];
  referralPartners: { id: string; name: string }[];
}) {
  const { run, isPending } = useCrudAction();

  const currentByMethodId = new Map(
    rates.filter((r) => r.effectiveTo === null).map((r) => [r.paymentMethodId, r])
  );

  const referralPartnerItems = [
    { value: NO_REFERRAL_PARTNER, label: "None (FoundaPay pure revenue)" },
    ...referralPartners.map((p) => ({ value: p.id, label: p.name })),
  ];

  const defaultEntries = paymentMethods.map((m) => ({
    paymentMethodId: m.id,
    ratePercent: "",
    feeBasis: "GROSS" as const,
    referralPartnerId: "",
    referralPartnerRatePercent: "",
  }));

  const form = useForm<ClientRateBatchFormValues>({
    resolver: zodResolver(clientRateBatchSchema),
    defaultValues: {
      effectiveFrom: format(new Date(), "yyyy-MM-dd"),
      entries: defaultEntries,
      notes: "",
    },
  });

  function onSubmit(values: ClientRateBatchFormValues) {
    run(() => saveClientRateBatch(clientId, values), {
      successMessage: "Rates saved",
      onSuccess: () =>
        form.reset({
          effectiveFrom: format(new Date(), "yyyy-MM-dd"),
          entries: defaultEntries,
          notes: "",
        }),
    });
  }

  const entriesError = form.formState.errors.entries?.message;

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
          {
            key: "referral",
            header: "Referral Split",
            render: (r) =>
              r.referralPartner
                ? `${r.referralPartner.name} ${r.referralPartnerRatePercent}% / FP ${(Number(r.ratePercent) - Number(r.referralPartnerRatePercent)).toFixed(2)}%`
                : "—",
          },
          { key: "from", header: "From", render: (r) => r.effectiveFrom },
          { key: "to", header: "To", render: (r) => r.effectiveTo ?? "current" },
        ]}
      />

      <div>
        <h3 className="mb-1 text-sm font-semibold">Set rates</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Leave a method blank if no rate has been agreed yet — a transaction using that
          method will be blocked rather than assumed free. Only methods you fill in below are
          saved; the rest are left untouched.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel hint="The date these new rates start applying. Any previous rate for a method you fill in below is closed off the day before this date.">Effective from (applies to every method below)</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Method</th>
                    <th className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Rate %
                        <FieldHint>FoundaPay&apos;s commission rate for this client on this payment method.</FieldHint>
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Fee Basis
                        <FieldHint>
                          Gross: the rate applies to the full transaction amount. After Merchant Charges: the
                          rate applies only after the merchant&apos;s own fee is deducted.
                        </FieldHint>
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Referral Partner
                        <FieldHint>
                          Optional -- if part of Rate % above is a referral commission owed to someone else
                          (e.g. Kamal earning 2% of Nimra Kashif&apos;s 9.5% combined rate), pick them here.
                          Leave as &quot;None&quot; if the whole rate is FoundaPay&apos;s own revenue.
                        </FieldHint>
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1">
                        Referral %
                        <FieldHint>
                          The referral partner&apos;s share of Rate % above (must be less than or equal to
                          it). The rest of Rate % is FoundaPay&apos;s own revenue -- the client is still
                          charged the full Rate % either way, this only records who the fee belongs to.
                        </FieldHint>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map((m, i) => {
                    const current = currentByMethodId.get(m.id);
                    return (
                      <tr key={m.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          <div className="pt-2">{m.name}</div>
                          {current ? (
                            <div className="text-xs text-muted-foreground">
                              currently {current.ratePercent}% ({FEE_BASIS_LABEL[current.feeBasis]})
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">no rate set</div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <FormField
                            control={form.control}
                            name={`entries.${i}.ratePercent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="blank"
                                    className="w-28"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <FormField
                            control={form.control}
                            name={`entries.${i}.feeBasis`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  items={FEE_BASIS_ITEMS}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full min-w-44">
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
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <FormField
                            control={form.control}
                            name={`entries.${i}.referralPartnerId`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value || NO_REFERRAL_PARTNER}
                                  onValueChange={(v) => field.onChange(v === NO_REFERRAL_PARTNER ? "" : v)}
                                  items={referralPartnerItems}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full min-w-44">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {referralPartnerItems.map((item) => (
                                      <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <FormField
                            control={form.control}
                            name={`entries.${i}.referralPartnerRatePercent`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="blank"
                                    className="w-24"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {entriesError && <p className="text-sm text-destructive">{entriesError}</p>}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Optional -- any context for this rate change, applies to every method saved together.">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Optional, applies to this whole save" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Save Rates"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

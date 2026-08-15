"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import { transactionSchema, type TransactionFormValues } from "../schema";
import { createTransaction, updateTransaction } from "../actions";

export type ClientOption = { id: string; name: string };
export type MerchantOption = {
  id: string;
  name: string;
  settlementBankId: string;
  defaultReservePercent: string;
};
export type BankOption = { id: string; name: string };
export type PaymentMethodOption = { id: string; name: string; requiresMerchant: boolean };

const FEE_BEARER_ITEMS = [
  { value: "FOUNDAPAY", label: "FoundaPay" },
  { value: "CLIENT", label: "Client" },
];

export function TransactionForm({
  clients,
  merchants,
  bankAccounts,
  paymentMethods,
  editingId,
  defaultValues: providedDefaultValues,
  onSuccess,
  hideChrome = false,
}: {
  clients: ClientOption[];
  merchants: MerchantOption[];
  bankAccounts: BankOption[];
  paymentMethods: PaymentMethodOption[];
  editingId?: string;
  defaultValues?: TransactionFormValues;
  onSuccess?: () => void;
  hideChrome?: boolean;
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: providedDefaultValues ?? {
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      clientId: "",
      clientReference: "",
      merchantId: "",
      expectedBankId: "",
      paymentMethodId: "",
      grossAmount: "",
      feeBearer: "CLIENT",
      merchantFeeManual: "",
      merchantReservePercent: "0",
      fpReservePercent: "0",
      documentUrl: "",
      notes: "",
      customerEmail: "",
      cardLast4: "",
    },
  });

  const merchantId = form.watch("merchantId");
  const paymentMethodId = form.watch("paymentMethodId");
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isDirect = !!selectedPaymentMethod && !selectedPaymentMethod.requiresMerchant;

  useEffect(() => {
    if (editingId) return; // don't clobber the existing bank/reserve on edit
    const merchant = merchants.find((m) => m.id === merchantId);
    if (merchant) {
      form.setValue("expectedBankId", merchant.settlementBankId);
      form.setValue("merchantReservePercent", merchant.defaultReservePercent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  useEffect(() => {
    if (isDirect) {
      form.setValue("merchantId", "");
      form.setValue("merchantReservePercent", "0");
      form.setValue("merchantFeeManual", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirect]);

  function onSubmit(values: TransactionFormValues) {
    run(
      async () => {
        const result = editingId
          ? await updateTransaction(editingId, values)
          : await createTransaction(values);
        if (result.ok) {
          toast.success(editingId ? "Transaction updated" : `Transaction ${result.id} created`);
          if (editingId) {
            onSuccess?.();
          } else {
            router.push("/transactions");
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grossAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gross amount</FormLabel>
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
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
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

            <FormField
              control={form.control}
              name="clientReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
              {!isDirect && (
                <FormField
                  control={form.control}
                  name="merchantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        items={merchants.map((m) => ({ value: m.id, label: m.name }))}
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
              )}
            </div>

            {/* Merchant-based: bank is always the merchant's configured
                settlement bank, silently -- nothing to pick or see here. */}
            {isDirect && (
              <FormField
                control={form.control}
                name="expectedBankId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank account (where the money landed)</FormLabel>
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
            )}

            {!isDirect && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="feeBearer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant fee bearer</FormLabel>
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
                  name="merchantFeeManual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant fee (actual, optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="Use rule default" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {!isDirect && (
                <FormField
                  control={form.control}
                  name="merchantReservePercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merchant reserve %</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="fpReservePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FoundaPay reserve %</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Optional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cardLast4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card last 4 digits</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={4} placeholder="Optional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="documentUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof / document link</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional URL" />
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
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : editingId ? "Save Changes" : "Create Transaction"}
            </Button>
          </form>
    </Form>
  );

  if (hideChrome) return formBody;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Transaction</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  );
}

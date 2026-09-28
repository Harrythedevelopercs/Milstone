"use client";

import { useEffect, useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCrudAction } from "@/hooks/use-crud-action";
import { transactionSchema, type TransactionFormValues } from "../schema";
import { createTransaction, updateTransaction } from "../actions";

export type ClientOption = {
  id: string;
  name: string;
  defaultReserveType?: "PERCENT" | "FIXED" | null;
  defaultReserveValue?: string | null;
  defaultReserveDirection?: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN" | null;
  defaultFeeBasis?: "GROSS" | "AFTER_MERCHANT_CHARGES" | null;
  defaultMerchantReserveBasis?: "GROSS" | "AFTER_MERCHANT_CHARGES" | null;
};
export type MerchantOption = {
  id: string;
  name: string;
  settlementBankId: string;
  defaultReservePercent: string;
  defaultReserveDirection: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN";
};
export type BankOption = { id: string; name: string };
export type PaymentMethodOption = { id: string; name: string; requiresMerchant: boolean };

const FEE_BEARER_ITEMS = [
  { value: "FOUNDAPAY", label: "FoundaPay" },
  { value: "CLIENT", label: "Client" },
];

const RESERVE_DIRECTION_ITEMS = [
  { value: "CLIENT_HELD", label: "Client-held (owed back to them)" },
  { value: "FP_FRONTED", label: "FP-fronted (they owe FoundaPay)" },
  { value: "FP_OWN", label: "FoundaPay-owned" },
];

const CHARGE_TYPE_ITEMS = [
  { value: "PERCENTAGE", label: "Percentage (client's rate)" },
  { value: "FIXED", label: "Fixed amount" },
  { value: "NONE", label: "No charge" },
];

const FEE_BASIS_ITEMS = [
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
];

const RESERVE_BASIS_ITEMS = [
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
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
  systemDefaultFeeBasis = "GROSS",
  systemDefaultMerchantReserveBasis = "GROSS",
}: {
  clients: ClientOption[];
  merchants: MerchantOption[];
  bankAccounts: BankOption[];
  paymentMethods: PaymentMethodOption[];
  editingId?: string;
  defaultValues?: TransactionFormValues;
  onSuccess?: () => void;
  hideChrome?: boolean;
  systemDefaultFeeBasis?: "GROSS" | "AFTER_MERCHANT_CHARGES";
  systemDefaultMerchantReserveBasis?: "GROSS" | "AFTER_MERCHANT_CHARGES";
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  // Possible-duplicate warning (same merchant + gross + transaction date):
  // set only when createTransaction reports isDuplicateWarning, holding the
  // values so "Save anyway" can resubmit with confirmDuplicate: true.
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; status: string } | null>(null);
  const [pendingValues, setPendingValues] = useState<TransactionFormValues | null>(null);
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
      feeBasis: systemDefaultFeeBasis,
      chargeType: "PERCENTAGE",
      fixedChargeAmount: "",
      feeBearer: "CLIENT",
      merchantFeeManual: "",
      merchantReservePercent: "0",
      merchantReserveBasis: systemDefaultMerchantReserveBasis,
      merchantReserveDirection: "CLIENT_HELD",
      fpReservePercent: "0",
      documentUrl: "",
      notes: "",
      customerEmail: "",
      cardLast4: "",
    },
  });

  const merchantId = form.watch("merchantId");
  const clientId = form.watch("clientId");
  const paymentMethodId = form.watch("paymentMethodId");
  const chargeType = form.watch("chargeType");
  const grossAmount = form.watch("grossAmount");
  const merchantFeeManual = form.watch("merchantFeeManual");
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isDirect = !!selectedPaymentMethod && !selectedPaymentMethod.requiresMerchant;
  const selectedClient = clients.find((c) => c.id === clientId);

  const grossNum = Number(grossAmount) || 0;
  // Direct-to-bank methods never have a merchant fee; for merchant-based
  // methods, an explicit manual entry is exact, otherwise this is only a
  // preview -- the actual fee falls back to the merchant's fee rule at save
  // time, which isn't known client-side.
  const previewMerchantFee = isDirect ? 0 : Number(merchantFeeManual) || 0;
  const netAmountReceivedPreview = (grossNum - previewMerchantFee).toFixed(2);

  // Precedence for the fee basis default: per-transaction override (once the
  // user touches this field themselves) > this client's default > the
  // System Settings global default. Re-resolved whenever the client changes
  // (fee basis doesn't depend on the merchant), same idea as the reserve
  // default below but kept as its own effect since it has a different
  // dependency set.
  useEffect(() => {
    if (editingId) return; // don't clobber the existing fee basis on edit
    form.setValue("feeBasis", selectedClient?.defaultFeeBasis ?? systemDefaultFeeBasis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Precedence for the reserve default: per-transaction override (once the
  // user touches these fields themselves) > this client's default > the
  // merchant's default. Re-resolved whenever the merchant or client
  // changes, same as the existing settlement-bank default below.
  useEffect(() => {
    if (editingId) return; // don't clobber the existing bank/reserve on edit
    const merchant = merchants.find((m) => m.id === merchantId);
    if (!merchant) return;
    const client = clients.find((c) => c.id === clientId);

    form.setValue("expectedBankId", merchant.settlementBankId);

    let percent = merchant.defaultReservePercent;
    let direction: "CLIENT_HELD" | "FP_FRONTED" | "FP_OWN" = merchant.defaultReserveDirection;
    if (client?.defaultReserveType === "PERCENT" && client.defaultReserveValue) {
      percent = client.defaultReserveValue;
    } else if (client?.defaultReserveType === "FIXED" && client.defaultReserveValue) {
      const gross = Number(grossAmount);
      if (gross > 0) percent = ((Number(client.defaultReserveValue) / gross) * 100).toFixed(2);
    }
    if (client?.defaultReserveDirection) direction = client.defaultReserveDirection;

    form.setValue("merchantReservePercent", percent);
    form.setValue("merchantReserveDirection", direction);
    form.setValue("merchantReserveBasis", client?.defaultMerchantReserveBasis ?? systemDefaultMerchantReserveBasis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, clientId]);

  useEffect(() => {
    if (isDirect) {
      form.setValue("merchantId", "");
      form.setValue("merchantReservePercent", "0");
      form.setValue("merchantFeeManual", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirect]);

  function doSubmit(values: TransactionFormValues, confirmDuplicate: boolean) {
    run(
      async () => {
        const result = editingId
          ? await updateTransaction(editingId, values)
          : await createTransaction(values, confirmDuplicate);
        if (result.ok) {
          toast.success(editingId ? "Transaction updated" : `Transaction ${result.id} created`);
          if (editingId) {
            onSuccess?.();
          } else {
            router.push("/transactions/received");
          }
          return { ok: true };
        }
        if ("isDuplicateWarning" in result) {
          setDuplicateWarning(result.duplicateOf);
          setPendingValues(values);
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  function onSubmit(values: TransactionFormValues) {
    doSubmit(values, false);
  }

  function confirmDuplicateAndSave() {
    if (!pendingValues) return;
    const values = pendingValues;
    setDuplicateWarning(null);
    setPendingValues(null);
    doSubmit(values, true);
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
                    <FormLabel hint="The date the customer's payment actually happened -- not today's date, and not the settlement date. Determines which accounting month this transaction posts to.">Transaction date</FormLabel>
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
                    <FormLabel hint="The full amount the customer paid, before any fees or reserves are deducted. Enter it exactly as charged, in the transaction's currency.">Gross amount</FormLabel>
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
                name="feeBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="What FoundaPay's fee (and the client's net payout) is calculated on. Gross: the full amount before merchant charges. Net: gross minus merchant charges. Defaults from the client's setting or, if unset, the System Settings global default -- always overridable here.">
                      Fee basis
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} items={FEE_BASIS_ITEMS}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FEE_BASIS_ITEMS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {selectedClient?.defaultFeeBasis
                        ? "Defaulted from this client's setting. Always overridable per transaction."
                        : "Defaulted from the System Settings global default (this client has no override). Always overridable per transaction."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel hint="Gross amount minus merchant charges. This is the base FP's fee is calculated on when Fee basis is Net. If a merchant fee hasn't been entered yet (using the rule default instead), this preview assumes zero merchant fee and the final stored figure may differ once the actual fee rule applies.">
                  Net amount received (preview)
                </FormLabel>
                <FormControl>
                  <Input value={netAmountReceivedPreview} readOnly disabled className="bg-muted" />
                </FormControl>
              </FormItem>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="chargeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="How FoundaPay's fee is calculated. Percentage uses the client's configured rate for this payment method. Fixed lets you enter a flat fee instead. No charge waives FP's fee entirely for this transaction.">Charge type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={CHARGE_TYPE_ITEMS}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CHARGE_TYPE_ITEMS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {chargeType === "FIXED" && (
                <FormField
                  control={form.control}
                  name="fixedChargeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel hint="The flat FoundaPay fee for this transaction, in place of the client's percentage rate.">Fixed charge amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which client this money belongs to. Their configured rate for the payment method below determines FoundaPay's fee, and their reserve defaults (if set) pre-fill the reserve fields further down.">Client</FormLabel>
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
                  <FormLabel hint="Optional -- the client's own invoice/order number for this transaction, for your records. Doesn't affect any calculation.">Client reference</FormLabel>
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
                    <FormLabel hint="How the customer paid. Methods that require a merchant (e.g. card processors) show a Merchant field below; direct methods (e.g. Wire, USDT) ask which bank account the money landed in instead.">Payment method</FormLabel>
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
                      <FormLabel hint="The processor/merchant account this payment ran through. Its configured settlement bank, fee rule, and default reserve % pre-fill automatically below.">Merchant</FormLabel>
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
                    <FormLabel hint="For direct-to-bank methods only -- which of FoundaPay's own bank/USDT/cash accounts actually received this payment.">Bank account (where the money landed)</FormLabel>
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
                      <FormLabel hint="Who absorbs the processor's merchant fee. FoundaPay: it reduces FP's own margin. Client: it's deducted from what the client is owed instead.">Merchant fee bearer</FormLabel>
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
                      <FormLabel hint="Leave blank to use the merchant's configured fee rule for this payment method. Enter a number to override it with the actual fee the processor charged.">Merchant fee (actual, optional)</FormLabel>
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
                      <FormLabel hint="Percent of the gross amount the processor withholds as a reserve, before it settles to FoundaPay's bank. Defaults from the client/merchant, but you can override it per transaction.">Merchant reserve %</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" min="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isDirect && (
                <FormField
                  control={form.control}
                  name="merchantReserveDirection"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel hint="Whose money the merchant reserve is. Client-held: still the client's money, owed back to them once released. FP-fronted: FoundaPay's own money put up for the client, who owes it back. FoundaPay-owned: purely FP's own reserve.">Reserve direction</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} items={RESERVE_DIRECTION_ITEMS}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESERVE_DIRECTION_ITEMS.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Defaulted from the client (if set) or the merchant. Always overridable.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {!isDirect && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="merchantReserveBasis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel hint="What the Merchant reserve % above is applied to. Gross: the full amount before merchant charges. Net: gross minus merchant charges. Defaults from the client's setting or, if unset, the System Settings global default -- always overridable here.">
                        Merchant reserve basis
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} items={RESERVE_BASIS_ITEMS}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESERVE_BASIS_ITEMS.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {selectedClient?.defaultMerchantReserveBasis
                          ? "Defaulted from this client's setting. Always overridable per transaction."
                          : "Defaulted from the System Settings global default (this client has no override). Always overridable per transaction."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fpReservePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Percent of the gross amount FoundaPay itself retains as a cushion, separate from anything the processor withholds. Always FoundaPay's own reserve.">FoundaPay reserve %</FormLabel>
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
                    <FormLabel hint="Optional -- the end customer's email, for your records only.">Customer email</FormLabel>
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
                    <FormLabel hint="Optional -- last 4 digits of the card used, for matching against statements later.">Card last 4 digits</FormLabel>
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
                  <FormLabel hint="Optional -- a link to a receipt, screenshot, or other proof of this transaction (e.g. a shared drive or cloud storage URL).">Proof / document link</FormLabel>
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
                  <FormLabel hint="Optional -- any free-text context worth keeping with this transaction.">Notes</FormLabel>
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

  const duplicateDialog = (
    <AlertDialog
      open={!!duplicateWarning}
      onOpenChange={(open) => {
        if (!open) {
          setDuplicateWarning(null);
          setPendingValues(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Possible duplicate</AlertDialogTitle>
          <AlertDialogDescription>
            A transaction for this merchant, amount and date already exists
            {duplicateWarning ? ` (${duplicateWarning.id}, status: ${duplicateWarning.status})` : ""}. Two genuine
            same-day, same-amount payments do happen -- if this one is real, save it anyway. Otherwise, cancel and
            double-check before re-entering it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDuplicateAndSave}>Save anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (hideChrome) {
    return (
      <>
        {formBody}
        {duplicateDialog}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Transaction</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
      {duplicateDialog}
    </Card>
  );
}

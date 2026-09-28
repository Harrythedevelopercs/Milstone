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
import { employeeTransactionSchema, type EmployeeTransactionFormValues } from "./schema";
import { submitTransaction } from "./actions";

export type Option = { id: string; name: string };
export type SubmitPaymentMethodOption = { id: string; name: string; requiresMerchant: boolean };

const EMPTY_VALUES = {
  transactionDate: format(new Date(), "yyyy-MM-dd"),
  clientId: "",
  clientReference: "",
  merchantId: "",
  bankAccountId: "",
  paymentMethodId: "",
  grossAmount: "",
  documentUrl: "",
  notes: "",
};

export function SubmitForm({
  clients,
  merchants,
  bankAccounts,
  paymentMethods,
}: {
  clients: Option[];
  merchants: Option[];
  bankAccounts: Option[];
  paymentMethods: SubmitPaymentMethodOption[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<EmployeeTransactionFormValues>({
    resolver: zodResolver(employeeTransactionSchema),
    defaultValues: EMPTY_VALUES,
  });
  // Possible-duplicate warning (same merchant + gross + transaction date):
  // set only when submitTransaction reports isDuplicateWarning, holding the
  // values so "Submit anyway" can resubmit with confirmDuplicate: true.
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; status: string } | null>(null);
  const [pendingValues, setPendingValues] = useState<EmployeeTransactionFormValues | null>(null);

  const paymentMethodId = form.watch("paymentMethodId");
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isDirect = !!selectedPaymentMethod && !selectedPaymentMethod.requiresMerchant;

  useEffect(() => {
    if (isDirect) form.setValue("merchantId", "");
    else form.setValue("bankAccountId", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirect]);

  function doSubmit(values: EmployeeTransactionFormValues, confirmDuplicate: boolean) {
    run(
      async () => {
        const result = await submitTransaction(values, confirmDuplicate);
        if (result.ok) {
          toast.success(`Submitted as ${result.id} — awaiting approval`);
          form.reset(EMPTY_VALUES);
          router.refresh();
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

  function onSubmit(values: EmployeeTransactionFormValues) {
    doSubmit(values, false);
  }

  function confirmDuplicateAndSubmit() {
    if (!pendingValues) return;
    const values = pendingValues;
    setDuplicateWarning(null);
    setPendingValues(null);
    doSubmit(values, true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date the customer's payment actually happened.">Date</FormLabel>
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
                    <FormLabel hint="The full amount the customer paid, before any fees.">Gross amount</FormLabel>
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
                  <FormLabel hint="Which client this payment is for.">Client</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentMethodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="How the customer paid.">Payment method</FormLabel>
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
              {isDirect ? (
                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel hint="Which FoundaPay bank account actually received this payment.">Bank account (where the money landed)</FormLabel>
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
              ) : (
                <FormField
                  control={form.control}
                  name="merchantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel hint="The processor/merchant account this payment ran through.">Merchant</FormLabel>
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

            <FormField
              control={form.control}
              name="clientReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Optional -- the client's own invoice/order number for this transaction.">Client reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documentUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Optional -- a link to a receipt or screenshot proving this payment.">Proof / document link</FormLabel>
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
                  <FormLabel hint="Optional -- any free-text context for whoever reviews this submission.">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </Form>
      </CardContent>
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
              same-day, same-amount payments do happen -- if this one is real, submit it anyway. Otherwise, cancel
              and double-check before re-entering it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDuplicateAndSubmit}>Submit anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

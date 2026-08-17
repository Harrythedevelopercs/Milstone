"use client";

import { useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { commissionPaymentSchema, type CommissionPaymentFormValues } from "../schema";
import { recordCommissionPayment } from "../actions";

export function PaymentPanel({
  employeeId,
  owed,
  bankAccounts,
}: {
  employeeId: string;
  owed: string;
  bankAccounts: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const { run, isPending } = useCrudAction();
  const form = useForm<CommissionPaymentFormValues>({
    resolver: zodResolver(commissionPaymentSchema),
    defaultValues: {
      amount: "",
      bankAccountId: "",
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  function onSubmit(values: CommissionPaymentFormValues) {
    run(() => recordCommissionPayment(employeeId, values), {
      successMessage: "Payment recorded",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Record Payment</Button>
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="Record Commission Payment"
        description={`Currently owed: ${owed}. Paying less than the full amount is fine -- the remainder carries forward.`}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" min="0" autoFocus />
                  </FormControl>
                  <FormDescription>Can be a partial payment -- the rest stays owed.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
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
              {isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </CrudSheet>
    </>
  );
}

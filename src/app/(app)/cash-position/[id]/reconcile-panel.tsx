"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { reconciliationSchema, type ReconciliationFormValues } from "../schema";
import { recordBankReconciliation } from "../actions";

export type ReconciliationRow = {
  id: string;
  asOfDate: string;
  bookBalance: string;
  actualBalance: string;
  differenceAmount: string;
  notes: string | null;
};

export function ReconcilePanel({
  bankAccountId,
  records,
  currentBookBalance,
}: {
  bankAccountId: string;
  records: ReconciliationRow[];
  currentBookBalance: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, isPending } = useCrudAction();
  const form = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: { asOfDate: format(new Date(), "yyyy-MM-dd"), actualBalance: "", notes: "" },
  });

  function onSubmit(values: ReconciliationFormValues) {
    run(() => recordBankReconciliation(bankAccountId, values), {
      successMessage: "Reconciliation recorded",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reconciliation History</h2>
        <Button onClick={() => setOpen(true)}>Record Reconciliation</Button>
      </div>

      <DataTable
        rows={records}
        rowKey={(r) => r.id}
        emptyMessage="No reconciliations recorded yet."
        columns={[
          { key: "date", header: "As of", render: (r) => r.asOfDate },
          { key: "book", header: "Book Balance", render: (r) => r.bookBalance },
          { key: "actual", header: "Actual Balance", render: (r) => r.actualBalance },
          {
            key: "diff",
            header: "Difference",
            render: (r) => (
              <span className={Number(r.differenceAmount) !== 0 ? "text-destructive font-medium" : ""}>
                {r.differenceAmount}
              </span>
            ),
          },
          { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
        ]}
      />

      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="Record Reconciliation"
        description={`Current book balance: ${currentBookBalance}`}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="asOfDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>As of date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="actualBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual balance (from statement/count)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" autoFocus />
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
              {isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </Form>
      </CrudSheet>
    </div>
  );
}

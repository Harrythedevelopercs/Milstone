"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DataTable } from "@/components/master-data/data-table";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import {
  vendorSubscriptionSchema,
  type VendorSubscriptionFormValues,
} from "./schema";
import { addVendorSubscription, setVendorSubscriptionStatus } from "./actions";

export type SubscriptionRow = {
  id: string;
  name: string;
  amount: string;
  billingCycle: string;
  nextBillingDate: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export function SubscriptionsPanel({
  vendorId,
  subscriptions,
}: {
  vendorId: string;
  subscriptions: SubscriptionRow[];
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<VendorSubscriptionFormValues>({
    resolver: zodResolver(vendorSubscriptionSchema),
    defaultValues: { name: "", amount: "", billingCycle: "", nextBillingDate: "" },
  });

  function onSubmit(values: VendorSubscriptionFormValues) {
    run(() => addVendorSubscription(vendorId, values), {
      successMessage: "Subscription added",
      onSuccess: () => form.reset({ name: "", amount: "", billingCycle: "", nextBillingDate: "" }),
    });
  }

  function toggleStatus(row: SubscriptionRow) {
    run(() => setVendorSubscriptionStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), {
      successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated",
    });
  }

  return (
    <div className="space-y-6">
      <DataTable
        rows={subscriptions}
        rowKey={(r) => r.id}
        emptyMessage="No subscriptions yet."
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "amount", header: "Amount", render: (r) => r.amount },
          { key: "cycle", header: "Cycle", render: (r) => r.billingCycle },
          { key: "next", header: "Next Billing", render: (r) => r.nextBillingDate ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <Button variant="ghost" size="sm" onClick={() => toggleStatus(r)}>
                {r.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            ),
          },
        ]}
      />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Add subscription</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="What this subscription is for (e.g. Dialpad, AWS).">Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The recurring charge amount -- pre-fills when recording an expense against this subscription.">Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="How often this charges, e.g. Monthly, Annual.">Billing cycle</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Monthly" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="nextBillingDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="When this subscription next charges -- updates automatically when you record an expense against it.">Next billing date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Add subscription"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

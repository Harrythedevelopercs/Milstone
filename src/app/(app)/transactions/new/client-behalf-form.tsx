"use client";

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
import { clientBehalfExpenseSchema, type ClientBehalfExpenseFormValues } from "./client-behalf-schema";
import { createClientBehalfExpense } from "./client-behalf-actions";

export type Option = { id: string; name: string };

export function ClientBehalfExpenseForm({
  clients,
  bankAccounts,
}: {
  clients: Option[];
  bankAccounts: Option[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<ClientBehalfExpenseFormValues>({
    resolver: zodResolver(clientBehalfExpenseSchema),
    defaultValues: {
      clientId: "",
      bankAccountId: "",
      amount: "",
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      description: "",
    },
  });

  function onSubmit(values: ClientBehalfExpenseFormValues) {
    run(
      async () => {
        const result = await createClientBehalfExpense(values);
        if (result.ok) {
          toast.success("Recorded — deducted from the client's balance");
          router.push("/client-ledger");
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>On Client&apos;s Behalf</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          This reduces what FoundaPay owes the client — it is not a FoundaPay expense.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which client FoundaPay is paying this cost for. Their balance is reduced by the amount below.">Client</FormLabel>
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
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which FoundaPay bank account actually paid this cost.">Paid from</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="How much FoundaPay paid on the client's behalf -- deducted from what FP owes them.">Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this was actually paid.">Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="A short description of what FoundaPay paid for -- shows on the client's ledger/statement.">What was this for?</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="e.g. Dialpad subscription paid on their behalf" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Record"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

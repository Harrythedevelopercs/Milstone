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
import { internalTransferSchema, type InternalTransferFormValues } from "../schema";
import { createInternalTransfer } from "../actions";

export type Option = { id: string; name: string; currency: string };

export function TransferForm({ accounts }: { accounts: Option[] }) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<InternalTransferFormValues>({
    resolver: zodResolver(internalTransferSchema),
    defaultValues: {
      fromBankAccountId: "",
      toBankAccountId: "",
      transferDate: format(new Date(), "yyyy-MM-dd"),
      amount: "",
      feeAmount: "0",
      usdValue: "",
      notes: "",
    },
  });

  const toId = form.watch("toBankAccountId");
  const toAccount = accounts.find((a) => a.id === toId);
  const showUsdValue = toAccount && toAccount.currency !== "USD";

  function onSubmit(values: InternalTransferFormValues) {
    run(
      async () => {
        const result = await createInternalTransfer(values);
        if (result.ok) {
          toast.success("Transfer recorded");
          router.push("/transfers");
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
        <CardTitle>New Internal Transfer</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromBankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({a.currency})
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
                name="toBankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({a.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transferDate"
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount received (destination currency)</FormLabel>
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
              name="feeAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transfer fee (deducted from source, FoundaPay&apos;s own cost)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showUsdValue && (
              <FormField
                control={form.control}
                name="usdValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>USD accounting value (manual, no auto FX)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="Defaults to amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
              {isPending ? "Saving..." : "Record Transfer"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

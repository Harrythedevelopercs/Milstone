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
  FormDescription,
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
export type ClientOption = { id: string; name: string };

const FEE_BEARER_ITEMS = [
  { value: "FOUNDAPAY", label: "FoundaPay" },
  { value: "CLIENT", label: "Client" },
];

export function TransferForm({ accounts, clients }: { accounts: Option[]; clients: ClientOption[] }) {
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
      feeBearer: "FOUNDAPAY",
      clientId: "",
      usdValue: "",
      notes: "",
    },
  });

  const toId = form.watch("toBankAccountId");
  const toAccount = accounts.find((a) => a.id === toId);
  const showUsdValue = toAccount && toAccount.currency !== "USD";
  const feeBearer = form.watch("feeBearer");
  const feeAmount = form.watch("feeAmount");
  const showClientPicker = feeBearer === "CLIENT" && Number(feeAmount || 0) > 0;

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
                    <FormLabel hint="The FoundaPay account the money is moving out of.">From</FormLabel>
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
                    <FormLabel hint="The FoundaPay account the money is moving into. Must be different from the From account.">To</FormLabel>
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
                    <FormLabel hint="The date this transfer actually happened.">Date</FormLabel>
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
                    <FormLabel hint="How much actually arrived in the destination account, in that account's own currency. Doesn't include the fee -- enter that separately below.">Amount received (destination currency)</FormLabel>
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
                name="feeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="What it cost to move this money between accounts, if anything. Who pays it is set by Fee Bearer to the right.">Transfer fee</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="feeBearer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Who absorbs the transfer fee. FoundaPay: deducted from the source account as FP's own cost. Client: billed to a client's ledger instead, picked below.">Fee bearer</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} items={FEE_BEARER_ITEMS}>
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
                    <FormDescription>
                      FoundaPay: deducted from the source account, FP&apos;s own cost. Client: the
                      source account only moves the transfer amount -- the fee bills to the
                      client below instead.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showClientPicker && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Which client's ledger gets charged for this transfer fee.">Client bearing the fee</FormLabel>
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
            )}

            {showUsdValue && (
              <FormField
                control={form.control}
                name="usdValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Since the destination isn't USD, enter its USD-equivalent value yourself -- there's no automatic exchange-rate conversion. Leave blank to use the amount as-is.">USD accounting value (manual, no auto FX)</FormLabel>
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
                  <FormLabel hint="What this transfer is for. Flows through to the client statement/ledger if a client bears the fee, and to the unified Transactions board either way.">Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="What this transfer is for" />
                  </FormControl>
                  <FormDescription>
                    Flows through to the client statement/ledger if a client bears the fee, and
                    to the unified Transactions board either way.
                  </FormDescription>
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

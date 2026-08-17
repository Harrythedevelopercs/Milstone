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
import { thirdPartySettlementSchema, type ThirdPartySettlementFormValues } from "../schema";
import { createThirdPartySettlement } from "../actions";

export type Option = { id: string; name: string };

const DIRECTION_ITEMS = [
  { value: "CLIENT_PAYABLE_TO_THIRD_PARTY", label: "Third party paid the client (reduces client payable)" },
  { value: "FP_PAID_THIRD_PARTY", label: "FoundaPay reimbursed the third party (from our bank)" },
];

export function ThirdPartySettlementForm({
  settlementParties,
  clients,
  bankAccounts,
}: {
  settlementParties: Option[];
  clients: Option[];
  bankAccounts: Option[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<ThirdPartySettlementFormValues>({
    resolver: zodResolver(thirdPartySettlementSchema),
    defaultValues: {
      settlementPartyId: "",
      direction: "CLIENT_PAYABLE_TO_THIRD_PARTY",
      clientId: "",
      bankAccountId: "",
      amount: "",
      settlementDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  const direction = form.watch("direction");

  function onSubmit(values: ThirdPartySettlementFormValues) {
    run(
      async () => {
        const result = await createThirdPartySettlement(values);
        if (result.ok) {
          toast.success("Settlement recorded");
          router.push("/third-party");
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
        <CardTitle>New Third-Party Settlement</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="settlementPartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="The external party (not a client or merchant) involved in this local settlement.">Settlement party</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={settlementParties.map((p) => ({ value: p.id, label: p.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a party" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {settlementParties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
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
              name="direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which direction the money moved -- determines whether this reduces a client's payable or comes out of FoundaPay's own bank.">What happened</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} items={DIRECTION_ITEMS}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIRECTION_ITEMS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {direction === "CLIENT_PAYABLE_TO_THIRD_PARTY" ? (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Which client's payable balance this settlement reduces.">Client</FormLabel>
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
            ) : (
              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Which FoundaPay bank account reimbursed the third party.">Paid from</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="How much was settled.">Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="settlementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this settlement actually happened.">Date</FormLabel>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Optional -- any context for this settlement.">Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Record Settlement"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

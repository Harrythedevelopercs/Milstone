"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";
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
import { drawingSchema } from "@/app/(app)/partner-ledger/schema";
import { recordPartnerDrawing } from "@/app/(app)/partner-ledger/actions";

const partnerDrawFormSchema = drawingSchema.extend({
  partnerId: z.string().trim().min(1, "Required"),
});
type PartnerDrawFormValues = z.infer<typeof partnerDrawFormSchema>;

export type Option = { id: string; name: string };

export function PartnerDrawForm({
  partners,
  bankAccounts,
}: {
  partners: Option[];
  bankAccounts: Option[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<PartnerDrawFormValues>({
    resolver: zodResolver(partnerDrawFormSchema),
    defaultValues: {
      partnerId: "",
      amount: "",
      bankAccountId: "",
      drawingDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  function onSubmit(values: PartnerDrawFormValues) {
    const { partnerId, ...rest } = values;
    run(
      async () => {
        const result = await recordPartnerDrawing(partnerId, rest);
        if (result.ok) {
          toast.success("Drawing recorded");
          router.push(`/partner-ledger/${partnerId}`);
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
        <CardTitle>Partner Personal Draw</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          This reduces the partner&apos;s own equity/drawing balance — it is not a business
          expense and does not affect company profit.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={partners.map((p) => ({ value: p.id, label: p.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a partner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partners.map((p) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="drawingDate"
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
            </div>

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
              {isPending ? "Saving..." : "Record Draw"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

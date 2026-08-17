"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldHint } from "@/components/ui/field-hint";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCrudAction } from "@/hooks/use-crud-action";
import { paymentMethodSchema, type PaymentMethodFormValues } from "./schema";
import { createPaymentMethod, updatePaymentMethod } from "./actions";

export function PaymentMethodForm({
  defaultValues,
  editingId,
  onSuccess,
}: {
  defaultValues: PaymentMethodFormValues;
  editingId: string | null;
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues,
  });

  function onSubmit(values: PaymentMethodFormValues) {
    run(() => (editingId ? updatePaymentMethod(editingId, values) : createPaymentMethod(values)), {
      successMessage: editingId ? "Payment method updated" : "Payment method added",
      onSuccess,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="The payment method's display name (e.g. Wire, Card, USDT), shown wherever a method is picked.">Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="requiresMerchant"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="inline-flex items-center gap-1">
                    Goes through a merchant
                    <FieldHint>
                      On: transaction entry requires picking a merchant (e.g. Card processors).
                      Off: direct-to-bank -- entry just picks a bank account instead.
                    </FieldHint>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    On: transaction entry requires a merchant (e.g. Card, Amex). Off:
                    direct-to-bank -- entry just picks a bank account (e.g. Wire, Cash, ACH,
                    USDT, Zelle).
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  );
}

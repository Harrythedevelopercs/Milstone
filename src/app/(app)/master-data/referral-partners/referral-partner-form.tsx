"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useCrudAction } from "@/hooks/use-crud-action";
import { referralPartnerSchema, type ReferralPartnerFormValues } from "./schema";
import { createReferralPartner, updateReferralPartner } from "./actions";

export function ReferralPartnerForm({
  defaultValues,
  editingId,
  onSuccess,
}: {
  defaultValues: ReferralPartnerFormValues;
  editingId: string | null;
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<ReferralPartnerFormValues>({
    resolver: zodResolver(referralPartnerSchema),
    defaultValues,
  });

  function onSubmit(values: ReferralPartnerFormValues) {
    run(() => (editingId ? updateReferralPartner(editingId, values) : createReferralPartner(values)), {
      successMessage: editingId ? "Referral partner updated" : "Referral partner added",
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
              <FormLabel hint="Who this referral partner is -- shown when setting a client's rate split, and on transactions their share applies to.">Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
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
              <FormLabel hint="Optional -- e.g. the referral arrangement, contact details, or which clients they're tied to.">Notes</FormLabel>
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
  );
}

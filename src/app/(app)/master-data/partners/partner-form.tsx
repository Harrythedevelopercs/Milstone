"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCrudAction } from "@/hooks/use-crud-action";
import { partnerSchema, type PartnerFormValues } from "./schema";
import { createPartner, updatePartner } from "./actions";

export type OwnerUserOption = { id: string; name: string; email: string };

export function PartnerForm({
  defaultValues,
  editingId,
  ownerUsers,
  onSuccess,
}: {
  defaultValues: PartnerFormValues;
  editingId: string | null;
  ownerUsers: OwnerUserOption[];
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues,
  });

  function onSubmit(values: PartnerFormValues) {
    run(() => (editingId ? updatePartner(editingId, values) : createPartner(values)), {
      successMessage: editingId ? "Partner updated" : "Partner added",
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
              <FormLabel hint="The partner's full name.">Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profitSharePercent"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="This partner's percentage of distributable monthly profit -- used when running the Monthly Distributions.">Profit share %</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.01" min="0" max="100" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="Optional -- connects this partner record to their sign-in account.">Linked login account</FormLabel>
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                items={[
                  { value: "none", label: "None" },
                  ...ownerUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
                ]}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ownerUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

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
import { systemSettingSchema, type SystemSettingFormValues } from "./schema";
import { createSystemSetting, updateSystemSetting } from "./actions";

export function SettingForm({
  defaultValues,
  editingKey,
  onSuccess,
}: {
  defaultValues: SystemSettingFormValues;
  editingKey: string | null;
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<SystemSettingFormValues>({
    resolver: zodResolver(systemSettingSchema),
    defaultValues,
  });

  function onSubmit(values: SystemSettingFormValues) {
    run(
      () =>
        editingKey ? updateSystemSetting(editingKey, values) : createSystemSetting(values),
      {
        successMessage: editingKey ? "Setting updated" : "Setting added",
        onSuccess,
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="key"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="A unique identifier for this setting (e.g. bonus_pool_percent). Can't be changed after creation.">Key</FormLabel>
              <FormControl>
                <Input {...field} autoFocus disabled={!!editingKey} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="The setting's current value -- format depends on what this setting is used for (a number, a flag, etc.).">Value</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel hint="Optional -- explain what this setting controls, for whoever edits it next.">Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
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

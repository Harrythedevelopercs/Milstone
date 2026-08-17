"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useCrudAction } from "@/hooks/use-crud-action";
import { clientSchema, type ClientFormValues } from "./schema";
import { createClient, updateClient } from "./actions";

const RESERVE_TYPE_ITEMS = [
  { value: "none", label: "No default (custom every time)" },
  { value: "PERCENT", label: "Percentage" },
  { value: "FIXED", label: "Fixed amount" },
];

const RESERVE_DIRECTION_ITEMS = [
  { value: "none", label: "No default" },
  { value: "CLIENT_HELD", label: "Client-held (owed back to them)" },
  { value: "FP_FRONTED", label: "FP-fronted (they owe FoundaPay)" },
  { value: "FP_OWN", label: "FoundaPay-owned" },
];

export function ClientForm({
  defaultValues,
  editingId,
  onSuccess,
}: {
  defaultValues: ClientFormValues;
  editingId: string | null;
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues,
  });

  function onSubmit(values: ClientFormValues) {
    run(() => (editingId ? updateClient(editingId, values) : createClient(values)), {
      successMessage: editingId ? "Client updated" : "Client added",
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Optional short code" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 rounded-md border p-3">
          <p className="text-sm font-medium">Default reserve handling</p>
          <FormDescription>
            Pre-fills the reserve % and direction whenever this client is picked on a
            transaction -- always overridable per transaction, and lower priority than the
            merchant&apos;s own default if this is left as &quot;no default&quot;.
          </FormDescription>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="defaultReserveType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reserve amount type</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                    items={RESERVE_TYPE_ITEMS}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RESERVE_TYPE_ITEMS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("defaultReserveType") !== "" && (
              <FormField
                control={form.control}
                name="defaultReserveValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("defaultReserveType") === "FIXED" ? "Fixed amount" : "Percent"}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          <FormField
            control={form.control}
            name="defaultReserveDirection"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default direction</FormLabel>
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  items={RESERVE_DIRECTION_ITEMS}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESERVE_DIRECTION_ITEMS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  );
}

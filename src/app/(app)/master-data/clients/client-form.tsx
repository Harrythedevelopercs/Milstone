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

const FEE_BASIS_ITEMS = [
  { value: "none", label: "No default (falls back to System Settings)" },
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
];

const RESERVE_BASIS_ITEMS = [
  { value: "none", label: "No default (falls back to System Settings)" },
  { value: "GROSS", label: "Gross (before merchant charges)" },
  { value: "AFTER_MERCHANT_CHARGES", label: "Net (after merchant charges)" },
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
              <FormLabel hint="The client's display name, used everywhere throughout the app (dropdowns, statements, reports).">Name</FormLabel>
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
              <FormLabel hint="Optional -- a short unique code for this client, for quick reference. Leave blank if not needed.">Code</FormLabel>
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
              <FormLabel hint="Optional -- the client's contact email, for your records.">Email</FormLabel>
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
              <FormLabel hint="Optional -- the client's contact phone number.">Phone</FormLabel>
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
              <FormLabel hint="Optional -- any internal context about this client.">Notes</FormLabel>
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
                  <FormLabel hint="Whether this client's default reserve is a percentage of the gross amount or a fixed dollar amount.">Reserve amount type</FormLabel>
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
                    <FormLabel hint="The default reserve value for this client's transactions -- pre-fills the form but can always be changed per transaction.">
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
                <FormLabel hint="Whose money this client's reserve defaults to being -- client-held, FP-fronted, or FoundaPay-owned. Takes priority over the merchant's default; always overridable per transaction.">Default direction</FormLabel>
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

        <div className="space-y-4 rounded-md border p-3">
          <p className="text-sm font-medium">Default fee basis</p>
          <FormDescription>
            What FoundaPay&apos;s fee (and this client&apos;s net payout) is calculated on for
            their transactions -- gross, or net of merchant charges. Takes priority over the
            System Settings global default; always overridable per transaction.
          </FormDescription>
          <FormField
            control={form.control}
            name="defaultFeeBasis"
            render={({ field }) => (
              <FormItem>
                <FormLabel hint="Gross: FP's fee and this client's net payout are calculated on the full gross amount. Net: calculated on gross minus merchant charges. Leave as 'no default' to fall back to the System Settings global default.">Fee basis</FormLabel>
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  items={FEE_BASIS_ITEMS}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FEE_BASIS_ITEMS.map((i) => (
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

        <div className="space-y-4 rounded-md border p-3">
          <p className="text-sm font-medium">Default merchant reserve basis</p>
          <FormDescription>
            What the merchant reserve % is calculated on for this client&apos;s transactions --
            gross, or net of merchant charges. Takes priority over the System Settings global
            default; always overridable per transaction.
          </FormDescription>
          <FormField
            control={form.control}
            name="defaultMerchantReserveBasis"
            render={({ field }) => (
              <FormItem>
                <FormLabel hint="Gross: the merchant reserve % is calculated on the full gross amount. Net: calculated on gross minus merchant charges. Leave as 'no default' to fall back to the System Settings global default.">Merchant reserve basis</FormLabel>
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  items={RESERVE_BASIS_ITEMS}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESERVE_BASIS_ITEMS.map((i) => (
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

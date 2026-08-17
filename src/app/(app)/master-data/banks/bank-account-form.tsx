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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCrudAction } from "@/hooks/use-crud-action";
import { bankAccountSchema, type BankAccountFormValues } from "./schema";
import { createBankAccount, updateBankAccount } from "./actions";

const ACCOUNT_TYPES = [
  { value: "BANK", label: "Bank" },
  { value: "USDT", label: "USDT Wallet" },
  { value: "CASH", label: "Cash" },
];

const COMPANY_BANK_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "NOT_APPLIED", label: "Not Applied" },
];

export type CompanyOption = { id: string; name: string };

export function BankAccountForm({
  defaultValues,
  editingId,
  companies,
  onSuccess,
}: {
  defaultValues: BankAccountFormValues;
  editingId: string | null;
  companies: CompanyOption[];
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues,
  });

  function onSubmit(values: BankAccountFormValues) {
    run(
      () => (editingId ? updateBankAccount(editingId, values) : createBankAccount(values)),
      {
        successMessage: editingId ? "Account updated" : "Account added",
        onSuccess,
      }
    );
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
                <Input {...field} autoFocus placeholder="e.g. Chase Operating" />
              </FormControl>
              <FormDescription>
                An internal nickname for this specific account (e.g. &quot;Operating&quot;,
                &quot;Payroll&quot;). Everywhere in the app this account is shown as
                &quot;Company - Bank Name&quot;, so it doesn&apos;t need to repeat the company or
                bank -- just what distinguishes this account from the company&apos;s other ones.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="accountType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} items={ACCOUNT_TYPES}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
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
          name="bankName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Chase, Bank of America, Mercury, Wise, PNC, USDT Wallet, Cash" />
              </FormControl>
              <FormDescription>
                The real institution. This is what makes two accounts under the same company
                distinguishable everywhere they&apos;re listed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company</FormLabel>
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                items={[
                  { value: "none", label: "None" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companies.map((c) => (
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
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status (for this company)</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                items={COMPANY_BANK_STATUSES}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMPANY_BANK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
          name="accountNumberMasked"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account number (masked)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="****1234" />
              </FormControl>
              <FormDescription>
                Optional. Last 4 digits or a masked reference only -- never the full account number.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="USD" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="openingBalance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opening balance</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.01" />
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

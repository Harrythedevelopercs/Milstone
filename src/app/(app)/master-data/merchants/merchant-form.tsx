"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { merchantSchema, type MerchantFormValues } from "./schema";
import { createMerchant, updateMerchant } from "./actions";

export type Option = { id: string; name: string };
export type BankAccountOption = {
  id: string;
  name: string;
  companyId: string | null;
  company: { name: string } | null;
};

export function MerchantForm({
  defaultValues,
  editingId,
  companies,
  businessUnits,
  bankAccounts,
  onSuccess,
}: {
  defaultValues: MerchantFormValues;
  editingId: string | null;
  companies: Option[];
  businessUnits: Option[];
  bankAccounts: BankAccountOption[];
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(merchantSchema),
    defaultValues,
  });

  const selectedCompanyId = form.watch("companyId");

  // This merchant's own company's banks come first (not restricted to them --
  // every other bank account is still pickable below, grouped by whichever
  // company it belongs to so it's clear whose account you're choosing).
  const bankGroups = useMemo(() => {
    const ownCompanyBanks = selectedCompanyId
      ? bankAccounts.filter((b) => b.companyId === selectedCompanyId)
      : [];

    const otherByCompany = new Map<string, { label: string; accounts: BankAccountOption[] }>();
    const unlinked: BankAccountOption[] = [];
    for (const b of bankAccounts) {
      if (selectedCompanyId && b.companyId === selectedCompanyId) continue;
      if (b.companyId && b.company) {
        if (!otherByCompany.has(b.companyId)) {
          otherByCompany.set(b.companyId, { label: b.company.name, accounts: [] });
        }
        otherByCompany.get(b.companyId)!.accounts.push(b);
      } else {
        unlinked.push(b);
      }
    }
    const otherGroups = Array.from(otherByCompany.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    return { ownCompanyBanks, otherGroups, unlinked };
  }, [bankAccounts, selectedCompanyId]);

  const bankSelectItems = [
    ...bankGroups.ownCompanyBanks.map((b) => ({ value: b.id, label: b.name })),
    ...bankGroups.otherGroups.flatMap((g) =>
      g.accounts.map((b) => ({ value: b.id, label: `${b.name} (${g.label})` }))
    ),
    ...bankGroups.unlinked.map((b) => ({ value: b.id, label: b.name })),
  ];

  function onSubmit(values: MerchantFormValues) {
    run(() => (editingId ? updateMerchant(editingId, values) : createMerchant(values)), {
      successMessage: editingId ? "Merchant updated" : "Merchant added",
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
          name="processor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Processor</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
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
                value={field.value}
                onValueChange={field.onChange}
                items={companies.map((c) => ({ value: c.id, label: c.name }))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
          name="businessUnitId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business unit</FormLabel>
              <Select
                value={field.value || "none"}
                onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                items={[
                  { value: "none", label: "None" },
                  ...businessUnits.map((b) => ({ value: b.id, label: b.name })),
                ]}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {businessUnits.map((b) => (
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
        <FormField
          control={form.control}
          name="settlementBankId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Settlement bank</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} items={bankSelectItems}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a bank account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankGroups.ownCompanyBanks.length > 0 && (
                    <>
                      <SelectGroup>
                        <SelectLabel>This company&apos;s banks</SelectLabel>
                        {bankGroups.ownCompanyBanks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                    </>
                  )}
                  {bankGroups.otherGroups.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.accounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  {bankGroups.unlinked.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Not linked to a company</SelectLabel>
                      {bankGroups.unlinked.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="settlementCycle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Settlement cycle</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Daily, Weekly, Monthly" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultReservePercent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default reserve %</FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.01" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="dailyLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daily limit</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="monthlyLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly limit</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="perTxnLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Per-txn limit</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" />
                </FormControl>
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

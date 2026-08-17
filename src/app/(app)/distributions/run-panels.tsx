"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import {
  runPayrollSchema,
  runEpCommissionsSchema,
  runPartnerDistributionSchema,
  type RunPayrollFormValues,
  type RunEpCommissionsFormValues,
  type RunPartnerDistributionFormValues,
} from "./schema";
import { runPayroll, runEmployeePartnerCommissions, runPartnerDistribution } from "./actions";

export function RunPayrollPanel({
  accountingMonth,
  bankAccounts,
  alreadyRun,
  totalPreview,
}: {
  accountingMonth: string;
  bankAccounts: { id: string; name: string }[];
  alreadyRun: boolean;
  totalPreview: string;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<RunPayrollFormValues>({
    resolver: zodResolver(runPayrollSchema),
    defaultValues: { accountingMonth, bankAccountId: "", paymentDate: format(new Date(), "yyyy-MM-dd") },
  });

  function onSubmit(values: RunPayrollFormValues) {
    run(() => runPayroll(values), { successMessage: "Payroll run" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Payroll</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Total configured salaries this month: <span className="font-medium">{totalPreview}</span>
        </p>
        {alreadyRun ? (
          <p className="text-sm text-emerald-600">Already run for {accountingMonth}.</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="Which FoundaPay bank account pays out this month's salaries.">Paid from</FormLabel>
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
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date salaries are actually paid.">Payment date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Running..." : "Run Payroll"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function RunEpCommissionsPanel({
  accountingMonth,
  alreadyRun,
  preview,
}: {
  accountingMonth: string;
  alreadyRun: boolean;
  preview: { name: string; revenue: string; commission: string }[];
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<RunEpCommissionsFormValues>({
    resolver: zodResolver(runEpCommissionsSchema),
    defaultValues: { accountingMonth, runDate: format(new Date(), "yyyy-MM-dd") },
  });

  function onSubmit(values: RunEpCommissionsFormValues) {
    run(() => runEmployeePartnerCommissions(values), { successMessage: "Commissions run" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Employee Partner Commissions (10%)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employee partners with revenue this month.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {preview.map((p) => (
              <li key={p.name} className="flex justify-between text-muted-foreground">
                <span>{p.name}</span>
                <span>
                  {p.revenue} × 10% = <span className="font-medium text-foreground">{p.commission}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {alreadyRun ? (
          <p className="text-sm text-emerald-600">Already run for {accountingMonth}.</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="runDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this run is recorded as effective.">Run date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Running..." : "Run Commissions"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

export function RunPartnerDistributionPanel({
  accountingMonth,
  alreadyRun,
  payrollRun,
  revenue,
  expenses,
  salaries,
  distributableProfit,
  bonusPoolPercent,
}: {
  accountingMonth: string;
  alreadyRun: boolean;
  payrollRun: boolean;
  revenue: string;
  expenses: string;
  salaries: string;
  distributableProfit: string;
  bonusPoolPercent: string;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<RunPartnerDistributionFormValues>({
    resolver: zodResolver(runPartnerDistributionSchema),
    defaultValues: { accountingMonth, runDate: format(new Date(), "yyyy-MM-dd") },
  });

  function onSubmit(values: RunPartnerDistributionFormValues) {
    run(() => runPartnerDistribution(values), { successMessage: "Partner distribution run" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Partner Profit Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Revenue (FP fee): {revenue}</p>
          <p>− Salaries: {salaries}</p>
          <p>− Expenses: {expenses}</p>
          <p className="font-medium text-foreground">Distributable profit: {distributableProfit}</p>
          <p>Bonus pool ({bonusPoolPercent}%) accrues from this too.</p>
        </div>
        {!payrollRun && !alreadyRun && (
          <p className="text-sm text-destructive">Run payroll first.</p>
        )}
        {alreadyRun ? (
          <p className="text-sm text-emerald-600">Already run for {accountingMonth}.</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="runDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hint="The date this run is recorded as effective.">Run date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending || !payrollRun} className="w-full">
                {isPending ? "Running..." : "Run Distribution"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

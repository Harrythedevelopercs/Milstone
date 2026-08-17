"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
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
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { useCrudAction } from "@/hooks/use-crud-action";
import { bonusAllocationSchema, type BonusAllocationFormValues } from "./schema";
import { allocateBonusPool } from "./actions";

export function AllocatePanel({ employees }: { employees: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const { run, isPending } = useCrudAction();
  const form = useForm<BonusAllocationFormValues>({
    resolver: zodResolver(bonusAllocationSchema),
    defaultValues: {
      employeeId: "",
      amount: "",
      allocationDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  function onSubmit(values: BonusAllocationFormValues) {
    run(() => allocateBonusPool(values), {
      successMessage: "Bonus allocated",
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Allocate Bonus</Button>
      <CrudSheet open={open} onOpenChange={setOpen} title="Allocate Bonus">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="Which employee is receiving this bonus.">Employee</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={employees.map((e) => ({ value: e.id, label: e.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="How much of the bonus pool to allocate to this employee -- reduces the remaining unallocated pool.">Amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allocationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint="The date this allocation is effective.">Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
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
                  <FormLabel hint="Optional -- why this bonus was allocated.">Notes</FormLabel>
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
      </CrudSheet>
    </>
  );
}

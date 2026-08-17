"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCrudAction } from "@/hooks/use-crud-action";
import { productServiceSchema, type ProductServiceFormValues } from "./schema";
import { createProductService, updateProductService } from "./actions";

export function ProductServiceForm({
  defaultValues,
  editingId,
  onSuccess,
}: {
  defaultValues: ProductServiceFormValues;
  editingId: string | null;
  onSuccess: () => void;
}) {
  const { run, isPending } = useCrudAction();
  const form = useForm<ProductServiceFormValues>({
    resolver: zodResolver(productServiceSchema),
    defaultValues,
  });

  function onSubmit(values: ProductServiceFormValues) {
    run(
      () =>
        editingId ? updateProductService(editingId, values) : createProductService(values),
      {
        successMessage: editingId ? "Updated" : "Added",
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
              <FormLabel hint="The product/service's display name, shown when recording a sale.">Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel hint="Default cost per unit -- pre-fills when recording a sale, driving the COGS/gross-profit calculation.">Cost</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" min="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sellPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel hint="Default price per unit -- pre-fills when recording a sale.">Sell price</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" min="0" />
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

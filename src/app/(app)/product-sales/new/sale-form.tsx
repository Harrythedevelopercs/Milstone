"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { productServiceSaleSchema, type ProductServiceSaleFormValues } from "../schema";
import { createProductServiceSale } from "../actions";

export type ProductOption = { id: string; name: string; cost: string; sellPrice: string };
export type Option = { id: string; name: string };

export function SaleForm({
  products,
  clients,
  businessUnits,
}: {
  products: ProductOption[];
  clients: Option[];
  businessUnits: Option[];
}) {
  const router = useRouter();
  const { run, isPending } = useCrudAction();
  const form = useForm<ProductServiceSaleFormValues>({
    resolver: zodResolver(productServiceSaleSchema),
    defaultValues: {
      productServiceId: "",
      clientId: "",
      businessUnitId: "",
      quantity: "1",
      unitCost: "",
      unitSellPrice: "",
      saleDate: format(new Date(), "yyyy-MM-dd"),
      deductFromClientBalance: false,
      notes: "",
    },
  });

  const quantity = form.watch("quantity");
  const unitCost = form.watch("unitCost");
  const unitSellPrice = form.watch("unitSellPrice");
  const qty = Number(quantity) || 0;
  const revenue = unitSellPrice ? new Decimal(unitSellPrice).times(qty) : new Decimal(0);
  const cost = unitCost ? new Decimal(unitCost).times(qty) : new Decimal(0);
  const grossProfit = revenue.minus(cost);

  function onSubmit(values: ProductServiceSaleFormValues) {
    run(
      async () => {
        const result = await createProductServiceSale(values);
        if (result.ok) {
          toast.success("Sale recorded");
          router.push("/product-sales");
          return { ok: true };
        }
        return result;
      },
      {}
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Product/Service Sale</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productServiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product / Service</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const p = products.find((p) => p.id === v);
                      if (p) {
                        form.setValue("unitCost", p.cost);
                        form.setValue("unitSellPrice", p.sellPrice);
                      }
                    }}
                    items={products.map((p) => ({ value: p.id, label: p.name }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a product/service" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="1" min="1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit cost</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitSellPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit sell price</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Revenue {revenue.toFixed(2)} · COGS {cost.toFixed(2)} · Gross profit {grossProfit.toFixed(2)}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                      items={[{ value: "none", label: "None" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {clients.map((c) => (
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
                      items={[{ value: "none", label: "None" }, ...businessUnits.map((b) => ({ value: b.id, label: b.name }))]}
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
            </div>

            <FormField
              control={form.control}
              name="saleDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deductFromClientBalance"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <FormLabel className="mb-0">Deduct from client balance</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Saving..." : "Record Sale"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

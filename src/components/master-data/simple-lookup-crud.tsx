"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { DataTable } from "@/components/master-data/data-table";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { StatusBadge } from "@/components/master-data/status-badge";
import { useCrudAction } from "@/hooks/use-crud-action";
import type { ActionResult } from "@/lib/action-result";

export type SimpleLookupRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = z.object({ name: z.string().trim().min(1, "Required") });
type FormValues = z.infer<typeof schema>;

export function SimpleLookupCrud({
  entityLabel,
  rows,
  createAction,
  updateAction,
  setStatusAction,
}: {
  entityLabel: string;
  rows: SimpleLookupRow[];
  createAction: (name: string) => Promise<ActionResult>;
  updateAction: (id: string, name: string) => Promise<ActionResult>;
  setStatusAction: (id: string, status: "ACTIVE" | "INACTIVE") => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState<SimpleLookupRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { run, isPending } = useCrudAction();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "" });
    setSheetOpen(true);
  }

  function openEdit(row: SimpleLookupRow) {
    setEditing(row);
    form.reset({ name: row.name });
    setSheetOpen(true);
  }

  function onSubmit(values: FormValues) {
    run(
      () =>
        editing
          ? updateAction(editing.id, values.name)
          : createAction(values.name),
      {
        successMessage: editing ? `${entityLabel} updated` : `${entityLabel} added`,
        onSuccess: () => setSheetOpen(false),
      }
    );
  }

  function toggleStatus(row: SimpleLookupRow) {
    run(
      () =>
        setStatusAction(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
      { successMessage: row.status === "ACTIVE" ? "Deactivated" : "Activated" }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{entityLabel}s</h1>
        <Button onClick={openCreate}>Add {entityLabel}</Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={`No ${entityLabel.toLowerCase()}s yet.`}
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleStatus(r)}>
                  {r.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel hint={`The ${entityLabel.toLowerCase()}'s display name, used throughout the app wherever a ${entityLabel.toLowerCase()} is picked.`}>Name</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus />
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
    </div>
  );
}

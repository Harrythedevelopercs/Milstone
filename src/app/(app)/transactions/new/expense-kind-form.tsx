"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ExpenseForm,
  type Option as ExpenseOption,
  type SubscriptionOption,
} from "@/app/(app)/expenses/new/expense-form";
import { ClientBehalfExpenseForm } from "./client-behalf-form";
import { PartnerDrawForm } from "./partner-draw-form";

export type Option = { id: string; name: string };

// Business Unit Expense currently uses the simple model: paid from FoundaPay's
// bank, tagged with businessUnitId, hits both FoundaPay's and the BU's P&L.
// A real funding/drawdown model (BU accrues a balance owed back to FoundaPay)
// is an approved future feature, not yet built — confirmed with user 2026-08-14.
const EXPENSE_KIND_ITEMS = [
  { value: "OPERATING", label: "FoundaPay Operating Expense" },
  { value: "BUSINESS_UNIT", label: "Business Unit Expense" },
  { value: "CLIENT_BEHALF", label: "On Client's Behalf" },
  { value: "PARTNER_DRAW", label: "Partner Personal Draw" },
];

export function ExpenseKindForm({
  categories,
  vendors,
  subscriptions,
  companies,
  businessUnits,
  bankAccounts,
  clients,
  partners,
}: {
  categories: ExpenseOption[];
  vendors: ExpenseOption[];
  subscriptions: SubscriptionOption[];
  companies: ExpenseOption[];
  businessUnits: ExpenseOption[];
  bankAccounts: Option[];
  clients: Option[];
  partners: Option[];
}) {
  const [kind, setKind] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expense Kind</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={kind} onValueChange={(v) => setKind(v ?? "")} items={EXPENSE_KIND_ITEMS}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an expense kind" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_KIND_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kind === "BUSINESS_UNIT" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Pick the business unit below — the expense is funded from FoundaPay and tagged to
              that unit&apos;s P&amp;L.
            </p>
          )}
        </CardContent>
      </Card>

      {(kind === "OPERATING" || kind === "BUSINESS_UNIT") && (
        <ExpenseForm
          categories={categories}
          vendors={vendors}
          subscriptions={subscriptions}
          companies={companies}
          businessUnits={businessUnits}
          bankAccounts={bankAccounts}
          clients={clients}
        />
      )}
      {kind === "CLIENT_BEHALF" && (
        <ClientBehalfExpenseForm clients={clients} bankAccounts={bankAccounts} />
      )}
      {kind === "PARTNER_DRAW" && (
        <PartnerDrawForm partners={partners} bankAccounts={bankAccounts} />
      )}
    </div>
  );
}

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
  TransactionForm,
  type ClientOption,
  type MerchantOption,
  type BankOption,
  type PaymentMethodOption,
} from "./transaction-form";
import {
  PayoutForm,
  type Option as PayoutOption,
  type PayableTransaction,
} from "@/app/(app)/payouts/new/payout-form";
import { TransferForm, type Option as TransferOption } from "@/app/(app)/transfers/new/transfer-form";
import {
  ExpenseKindForm,
  type Option as ExpenseKindOption,
} from "./expense-kind-form";
import type { Option as ExpenseOption, SubscriptionOption } from "@/app/(app)/expenses/new/expense-form";

const TRANSACTION_TYPE_ITEMS = [
  { value: "RECEIVED", label: "Received" },
  { value: "PAYOUT", label: "Sent / Payout" },
  { value: "TRANSFER", label: "Internal Transfer" },
  { value: "EXPENSE", label: "Expense" },
];

export function TransactionTypeForm({
  clients,
  merchants,
  bankAccounts,
  paymentMethods,
  payoutMethods,
  payableTransactions,
  transferAccounts,
  expenseCategories,
  vendors,
  subscriptions,
  companies,
  businessUnits,
  partners,
}: {
  clients: ClientOption[];
  merchants: MerchantOption[];
  bankAccounts: BankOption[];
  paymentMethods: PaymentMethodOption[];
  payoutMethods: PayoutOption[];
  payableTransactions: PayableTransaction[];
  transferAccounts: TransferOption[];
  expenseCategories: ExpenseOption[];
  vendors: ExpenseOption[];
  subscriptions: SubscriptionOption[];
  companies: ExpenseOption[];
  businessUnits: ExpenseOption[];
  partners: ExpenseKindOption[];
}) {
  const [type, setType] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={type} onValueChange={(v) => setType(v ?? "")} items={TRANSACTION_TYPE_ITEMS}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a transaction type" />
            </SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {type === "RECEIVED" && (
        <TransactionForm
          clients={clients}
          merchants={merchants}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
        />
      )}
      {type === "PAYOUT" && (
        <PayoutForm
          clients={clients}
          payoutMethods={payoutMethods}
          bankAccounts={bankAccounts}
          payableTransactions={payableTransactions}
        />
      )}
      {type === "TRANSFER" && <TransferForm accounts={transferAccounts} />}
      {type === "EXPENSE" && (
        <ExpenseKindForm
          categories={expenseCategories}
          vendors={vendors}
          subscriptions={subscriptions}
          companies={companies}
          businessUnits={businessUnits}
          bankAccounts={bankAccounts}
          clients={clients}
          partners={partners}
        />
      )}
    </div>
  );
}

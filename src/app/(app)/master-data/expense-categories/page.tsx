import { prisma } from "@/lib/prisma";
import { SimpleLookupCrud } from "@/components/master-data/simple-lookup-crud";
import {
  createExpenseCategory,
  updateExpenseCategory,
  setExpenseCategoryStatus,
} from "./actions";

export default async function ExpenseCategoriesPage() {
  const rows = await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <SimpleLookupCrud
      entityLabel="Expense Category"
      rows={rows}
      createAction={createExpenseCategory}
      updateAction={updateExpenseCategory}
      setStatusAction={setExpenseCategoryStatus}
    />
  );
}

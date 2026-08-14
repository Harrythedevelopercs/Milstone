import { prisma } from "@/lib/prisma";
import { TransferForm } from "./transfer-form";

export default async function NewTransferPage() {
  const accounts = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, currency: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <TransferForm accounts={accounts} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { getDefaultFeeBasis } from "@/lib/transactions/fee-basis";
import { SettingsClient } from "./settings-client";
import { DefaultFeeBasisPanel } from "./default-fee-basis-panel";

export default async function SettingsPage() {
  const [rows, defaultFeeBasis] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    getDefaultFeeBasis(),
  ]);
  return (
    <div className="space-y-6">
      <DefaultFeeBasisPanel value={defaultFeeBasis} />
      <SettingsClient rows={rows} />
    </div>
  );
}

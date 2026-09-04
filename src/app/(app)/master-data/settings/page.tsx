import { prisma } from "@/lib/prisma";
import { getDefaultFeeBasis } from "@/lib/transactions/fee-basis";
import { getDefaultMerchantReserveBasis } from "@/lib/transactions/reserve-basis";
import { getRoundingConfig } from "@/lib/transactions/rounding";
import { SettingsClient } from "./settings-client";
import { DefaultFeeBasisPanel } from "./default-fee-basis-panel";
import { DefaultMerchantReserveBasisPanel } from "./default-merchant-reserve-basis-panel";
import { RoundingRulePanel } from "./rounding-rule-panel";

export default async function SettingsPage() {
  const [rows, defaultFeeBasis, defaultMerchantReserveBasis, roundingConfig] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    getDefaultFeeBasis(),
    getDefaultMerchantReserveBasis(),
    getRoundingConfig(),
  ]);
  return (
    <div className="space-y-6">
      <DefaultFeeBasisPanel value={defaultFeeBasis} />
      <DefaultMerchantReserveBasisPanel value={defaultMerchantReserveBasis} />
      <RoundingRulePanel stage={roundingConfig.stage} mode={roundingConfig.mode} />
      <SettingsClient rows={rows} />
    </div>
  );
}

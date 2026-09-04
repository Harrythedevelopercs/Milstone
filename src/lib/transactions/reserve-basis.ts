import { prisma } from "@/lib/prisma";
import type { FeeBasis } from "./money-math";

export const DEFAULT_MERCHANT_RESERVE_BASIS_SETTING_KEY = "default_merchant_reserve_basis";
export const FALLBACK_MERCHANT_RESERVE_BASIS: FeeBasis = "GROSS";

function isFeeBasis(value: string | undefined | null): value is FeeBasis {
  return value === "GROSS" || value === "AFTER_MERCHANT_CHARGES";
}

// The System Settings global default -- last resort in the three-level
// precedence (per-transaction > per-client > this). Falls back to GROSS
// (the historical, pre-this-feature behavior -- reserve was always computed
// on the gross amount before this control existed) if never set.
export async function getDefaultMerchantReserveBasis(): Promise<FeeBasis> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: DEFAULT_MERCHANT_RESERVE_BASIS_SETTING_KEY },
  });
  return isFeeBasis(setting?.value) ? setting.value : FALLBACK_MERCHANT_RESERVE_BASIS;
}

// Per-transaction override > this client's default > the System Settings
// global default. Same precedence shape as resolveFeeBasis.
export function resolveMerchantReserveBasis(params: {
  transactionOverride?: FeeBasis | null;
  clientDefault?: FeeBasis | null;
  systemDefault: FeeBasis;
}): FeeBasis {
  return params.transactionOverride ?? params.clientDefault ?? params.systemDefault;
}

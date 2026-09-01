import { prisma } from "@/lib/prisma";
import type { FeeBasis } from "./money-math";

export const DEFAULT_FEE_BASIS_SETTING_KEY = "default_fee_basis";
export const FALLBACK_FEE_BASIS: FeeBasis = "GROSS";

function isFeeBasis(value: string | undefined | null): value is FeeBasis {
  return value === "GROSS" || value === "AFTER_MERCHANT_CHARGES";
}

// The System Settings global default -- last resort in the three-level
// precedence (per-transaction > per-client > this). Falls back to GROSS
// (the historical, pre-this-feature behavior) if the setting was never set.
export async function getDefaultFeeBasis(): Promise<FeeBasis> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: DEFAULT_FEE_BASIS_SETTING_KEY },
  });
  return isFeeBasis(setting?.value) ? setting.value : FALLBACK_FEE_BASIS;
}

// Per-transaction override > this client's default > the System Settings
// global default. Used both when entering a transaction (form resolves this
// to show/pre-fill it) and server-side as the source of truth actually
// stored on the transaction.
export function resolveFeeBasis(params: {
  transactionOverride?: FeeBasis | null;
  clientDefault?: FeeBasis | null;
  systemDefault: FeeBasis;
}): FeeBasis {
  return params.transactionOverride ?? params.clientDefault ?? params.systemDefault;
}

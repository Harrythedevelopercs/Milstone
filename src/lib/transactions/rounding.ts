import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";

// Two independent knobs over how a transaction's money math rounds to cents.
// Global only (System Settings) -- unlike fee basis / reserve basis, this is
// an accounting-policy choice that should stay uniform across the whole
// ledger, not vary transaction-by-transaction or client-by-client (that
// would make historical figures impossible to compare against each other).
// Decimal places are NOT configurable: every money column is
// Decimal(18, 2) and USD accounting is cents-based, so there is no real
// scenario where a different scale would be correct.
export type RoundingStage = "COMPONENT" | "FINAL";
export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";

export const ROUNDING_STAGE_SETTING_KEY = "rounding_stage";
export const ROUNDING_MODE_SETTING_KEY = "rounding_mode";

// FINAL (current/historical behavior): each intermediate amount (FP fee,
// merchant reserve, FP reserve, merchant fee) is carried at full decimal
// precision into the Client Net Payable calculation, and only the values
// actually stored/displayed are rounded to cents. COMPONENT: each
// intermediate amount is rounded to cents immediately after it's computed,
// and that rounded figure is what subsequent calculations (and Client Net
// Payable) use -- this is how a manual spreadsheet typically works, since
// each cell independently rounds via ROUND() and later formulas reference
// the rounded cell, not the raw value.
export const FALLBACK_ROUNDING_STAGE: RoundingStage = "FINAL";
export const FALLBACK_ROUNDING_MODE: RoundingMode = "HALF_UP";

const ROUNDING_MODE_MAP: Record<RoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
};

export const ROUNDING_STAGE_ITEMS: { value: RoundingStage; label: string }[] = [
  { value: "FINAL", label: "Round only the final result (current default)" },
  { value: "COMPONENT", label: "Round each component, then carry the rounded figure forward" },
];

export const ROUNDING_MODE_ITEMS: { value: RoundingMode; label: string }[] = [
  { value: "HALF_UP", label: "Half up (0.005 -> 0.01) -- standard, current default" },
  { value: "HALF_EVEN", label: "Half to even (banker's rounding)" },
  { value: "UP", label: "Always round up (away from zero)" },
  { value: "DOWN", label: "Always round down (toward zero, truncate)" },
];

function isRoundingStage(value: string | undefined | null): value is RoundingStage {
  return value === "COMPONENT" || value === "FINAL";
}

function isRoundingMode(value: string | undefined | null): value is RoundingMode {
  return value === "HALF_UP" || value === "HALF_EVEN" || value === "UP" || value === "DOWN";
}

export async function getRoundingConfig(): Promise<{ stage: RoundingStage; mode: RoundingMode }> {
  const [stageSetting, modeSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: ROUNDING_STAGE_SETTING_KEY } }),
    prisma.systemSetting.findUnique({ where: { key: ROUNDING_MODE_SETTING_KEY } }),
  ]);
  return {
    stage: isRoundingStage(stageSetting?.value) ? stageSetting.value : FALLBACK_ROUNDING_STAGE,
    mode: isRoundingMode(modeSetting?.value) ? modeSetting.value : FALLBACK_ROUNDING_MODE,
  };
}

// Rounds to cents using the given mode -- a local, per-call override (never
// mutates Decimal's global config, which would affect every other Decimal
// operation in the process).
export function roundMoney(value: Decimal.Value, mode: RoundingMode = FALLBACK_ROUNDING_MODE): string {
  return new Decimal(value).toFixed(2, ROUNDING_MODE_MAP[mode]);
}

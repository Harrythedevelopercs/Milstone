"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrudAction } from "@/hooks/use-crud-action";
import { setRoundingConfig } from "./actions";

// Mirrored from src/lib/transactions/rounding.ts (types and item labels only,
// not re-exported from there) -- that module also imports prisma, which
// would otherwise get pulled into this client bundle.
type RoundingStage = "COMPONENT" | "FINAL";
type RoundingMode = "HALF_UP" | "HALF_EVEN" | "UP" | "DOWN";

const ROUNDING_STAGE_ITEMS: { value: RoundingStage; label: string }[] = [
  { value: "FINAL", label: "Round only the final result (current default)" },
  { value: "COMPONENT", label: "Round each component, then carry the rounded figure forward" },
];

const ROUNDING_MODE_ITEMS: { value: RoundingMode; label: string }[] = [
  { value: "HALF_UP", label: "Half up (0.005 -> 0.01) -- standard, current default" },
  { value: "HALF_EVEN", label: "Half to even (banker's rounding)" },
  { value: "UP", label: "Always round up (away from zero)" },
  { value: "DOWN", label: "Always round down (toward zero, truncate)" },
];

export function RoundingRulePanel({
  stage: initialStage,
  mode: initialMode,
}: {
  stage: RoundingStage;
  mode: RoundingMode;
}) {
  const [stage, setStage] = useState<RoundingStage>(initialStage);
  const [mode, setMode] = useState<RoundingMode>(initialMode);
  const { run, isPending } = useCrudAction();

  function save() {
    run(() => setRoundingConfig({ stage, mode }), { successMessage: "Rounding rule updated" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rounding Rule</CardTitle>
        <CardDescription>
          Global only -- applies to every future transaction&apos;s money math, not per-client or
          per-transaction (an accounting policy should stay uniform across the whole ledger).
          Decimal places are fixed at 2 (cents) and are not configurable. Existing transactions
          keep whatever figures they already stored -- changing this never recalculates history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rounding stage</label>
            <Select value={stage} onValueChange={(v) => setStage(v as RoundingStage)} items={ROUNDING_STAGE_ITEMS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_STAGE_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Rounding mode</label>
            <Select value={mode} onValueChange={(v) => setMode(v as RoundingMode)} items={ROUNDING_MODE_ITEMS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_MODE_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

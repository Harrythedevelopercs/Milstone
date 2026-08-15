"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/tone-badge";
import { BankStatusBadge } from "@/components/master-data/bank-status-badge";
import { DownloadButtons } from "@/components/exports/download-buttons";
import { NEEDS_ATTENTION_ROW_CLASS } from "@/lib/status-tone";
import type { BankAccountRow } from "./banks-client";

const OTHER_GROUP_KEY = "__other__";

export function CompanyBankGroups({
  rows,
  onEdit,
  onToggleActive,
}: {
  rows: BankAccountRow[];
  onEdit: (row: BankAccountRow) => void;
  onToggleActive: (row: BankAccountRow) => void;
}) {
  const groups = useMemo(() => {
    const byCompany = new Map<string, { company: { id: string; name: string } | null; accounts: BankAccountRow[] }>();
    for (const row of rows) {
      const key = row.company?.id ?? OTHER_GROUP_KEY;
      if (!byCompany.has(key)) {
        byCompany.set(key, { company: row.company, accounts: [] });
      }
      byCompany.get(key)!.accounts.push(row);
    }
    const groupList = Array.from(byCompany.values());
    groupList.sort((a, b) => {
      if (!a.company) return 1;
      if (!b.company) return -1;
      return a.company.name.localeCompare(b.company.name);
    });
    return groupList;
  }, [rows]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No bank accounts yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const key = group.company?.id ?? OTHER_GROUP_KEY;
        const isCollapsed = collapsed.has(key);
        const title = group.company?.name ?? "Not linked to a company";
        return (
          <div key={key} className="rounded-md border">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40"
            >
              <span className="flex items-center gap-2 font-medium">
                {isCollapsed ? (
                  <ChevronRight className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
                {title}
                <Badge variant="outline">{group.accounts.length}</Badge>
              </span>
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Bank</th>
                      <th className="px-4 py-2 text-left font-medium">Currency</th>
                      <th className="px-4 py-2 text-right font-medium">Current Balance</th>
                      <th className="px-4 py-2 text-left font-medium">Company Status</th>
                      <th className="px-4 py-2 text-left font-medium">Active</th>
                      <th className="px-4 py-2 text-left font-medium">Ledger</th>
                      <th className="px-4 py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((r) => {
                      const negative = Number(r.currentBalance) < 0;
                      const attentionRow = negative || r.status === "SUSPENDED";
                      return (
                      <tr key={r.id} className={`border-b last:border-b-0 ${attentionRow ? NEEDS_ATTENTION_ROW_CLASS : ""}`}>
                        <td className="px-4 py-2">{r.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.bankName ?? "—"}</td>
                        <td className="px-4 py-2">{r.currency}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            negative ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {r.currentBalance}
                        </td>
                        <td className="px-4 py-2">
                          <BankStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2">
                          <ToneBadge tone={r.active ? "success" : "neutral"}>
                            {r.active ? "Active" : "Inactive"}
                          </ToneBadge>
                        </td>
                        <td className="px-4 py-2">
                          <DownloadButtons reportType="bank-ledger" params={{ id: r.id }} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => onEdit(r)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onToggleActive(r)}>
                              {r.active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

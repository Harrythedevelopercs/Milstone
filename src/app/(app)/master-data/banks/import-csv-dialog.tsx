"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CrudSheet } from "@/components/master-data/crud-sheet";
import { toast } from "sonner";
import { importCompanyBanksAction } from "./import-actions";
import type { CompanyBanksImportResult } from "@/lib/imports/company-banks";

export function ImportCsvDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CompanyBanksImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    setResult(null);
    setError(null);
    setFileName(null);
    setOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const outcome = await importCompanyBanksAction(formData);
      if (!outcome.ok) {
        setError(outcome.error);
        toast.error(outcome.error);
        return;
      }
      setResult(outcome.result);
      toast.success("Import finished — see the summary below.");
    });
  }

  function pickFile() {
    inputRef.current?.click();
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        Import from CSV
      </Button>

      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="Import Company Banks from CSV"
        description="Re-runnable — safe to import the same file again after fixing anything."
        widthClassName="sm:max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Expected columns</p>
            <p className="mt-1">
              <code className="rounded bg-muted px-1 py-0.5">Company Name</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">Behalf Of</code>, then one column per
              bank (header = bank name, e.g. Mercury, Bank of America, Wise). Cell values:{" "}
              <strong>Active</strong>, <strong>Suspended</strong>, or <strong>Not Applied</strong>.
              Not Applied and blank cells are skipped — no account is created for them.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button onClick={pickFile} disabled={isPending} className="w-full">
            {isPending ? "Importing..." : fileName ? `Re-select file (${fileName})` : "Choose CSV file"}
          </Button>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {result.rowCount} row(s) processed, {result.bankColumns.length} bank column(s):{" "}
                  {result.bankColumns.join(", ")}
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    Companies: {result.companiesCreated} created, {result.companiesUpdated} updated
                  </li>
                  <li>
                    Bank accounts: {result.banksCreated} created, {result.banksUpdated} updated,{" "}
                    {result.banksSkippedNotApplied} &quot;Not Applied&quot; skipped
                  </li>
                </ul>
              </div>

              {result.log.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border p-3 text-xs text-muted-foreground">
                  {result.log.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}

              {result.notes.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Notes</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.unmatchedBehalfOf.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    &quot;Behalf Of&quot; names not found in Employees — add these first, then
                    re-import:
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {result.unmatchedBehalfOf.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </CrudSheet>
    </>
  );
}

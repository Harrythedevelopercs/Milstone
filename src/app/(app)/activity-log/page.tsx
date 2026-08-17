import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/empty-table-row";
import { ToneBadge } from "@/components/ui/tone-badge";
import { SnapshotDialog } from "./snapshot-dialog";

const PAGE_SIZE = 100;

const ACTION_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  CREATE: "success",
  DELETE: "danger",
  UPDATE: "warning",
  CLOSE: "neutral",
  REOPEN: "danger",
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; performedById?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { entityType, performedById, from, to } = sp;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(performedById ? { performedById } : {}),
    ...(fromDate || toDate
      ? { performedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [logs, totalCount, entityTypes, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { performedBy: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageHref(p: number) {
    const query = new URLSearchParams();
    if (entityType) query.set("entityType", entityType);
    if (performedById) query.set("performedById", performedById);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    query.set("page", String(p));
    return `/activity-log?${query.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Every create, edit, and delete across the app -- who, when, and what changed.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">From</label>
          <input id="from" name="from" type="date" defaultValue={from} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">To</label>
          <input id="to" name="to" type="date" defaultValue={to} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="entityType" className="text-xs text-muted-foreground">Entity</label>
          <select id="entityType" name="entityType" defaultValue={entityType ?? ""} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">All entities</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="performedById" className="text-xs text-muted-foreground">User</label>
          <select id="performedById" name="performedById" defaultValue={performedById ?? ""} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted">Filter</button>
        {(from || to || entityType || performedById) && (
          <Link href="/activity-log" className="h-8 self-center px-3 text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <EmptyTableRow colSpan={6} message="No activity matches these filters." />
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(log.performedAt, "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>{log.performedBy.name}</TableCell>
                  <TableCell>
                    <span className="font-medium">{log.entityType}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{log.entityId}</span>
                  </TableCell>
                  <TableCell>
                    <ToneBadge tone={ACTION_TONE[log.action] ?? "neutral"}>{log.action}</ToneBadge>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">{log.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <SnapshotDialog before={log.beforeSnapshot} after={log.afterSnapshot} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalCount === 0 ? "No activity" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted">
              Previous
            </Link>
          )}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted">
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

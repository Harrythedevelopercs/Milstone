import { prisma } from "@/lib/prisma";

// Most models only store createdById/approvedById/settledById etc. as bare
// scalar FKs with no declared User relation (Transaction and AuditLog are
// the only ones that do) -- this resolves a batch of such ids to names in
// one query, for building a detail view's "who did what" fields.
export async function resolveUserNames(
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((v): v is string => !!v))];
  if (uniqueIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

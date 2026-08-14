export type ActionResult = { ok: true } | { ok: false; error: string };

export const PRISMA_FK_VIOLATION = "P2003";
export const PRISMA_UNIQUE_VIOLATION = "P2002";
export const PRISMA_NOT_FOUND = "P2025";

export function isPrismaError(
  error: unknown,
  code: string
): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

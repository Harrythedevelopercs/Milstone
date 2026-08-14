"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit-log";
import { signOut } from "@/auth";
import { changePasswordSchema } from "./schema";

// After this, the user must sign back in -- the JWT session already carries
// the old mustChangePassword value and there's no cheap way to refresh it
// mid-session, so a fresh login is the simplest way to get a session that
// reflects the new password and the cleared flag.
export async function changePasswordAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return parsed.error.issues[0].message;

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await writeAuditLog(tx, {
      entityType: "User",
      entityId: user.id,
      action: "CHANGE_PASSWORD",
      performedById: user.id,
    });
  });

  await signOut({ redirectTo: "/login?passwordChanged=1" });
}

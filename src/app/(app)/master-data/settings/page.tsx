import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return <SettingsClient rows={rows} />;
}

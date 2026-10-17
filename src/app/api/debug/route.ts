import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    nodeVersion: process.version,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authTrustHost: process.env.AUTH_TRUST_HOST,
    authUrl: process.env.AUTH_URL,
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    diagnostics.prismaLoaded = true;
    const count = await prisma.user.count();
    diagnostics.userCount = count;
  } catch (err: any) {
    diagnostics.prismaError = {
      message: err?.message,
      name: err?.name,
      code: err?.code,
      stack: err?.stack,
    };
  }

  try {
    const { auth } = await import("@/auth");
    diagnostics.authLoaded = true;
  } catch (err: any) {
    diagnostics.authError = {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    };
  }

  return NextResponse.json(diagnostics);
}

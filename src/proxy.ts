import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}

export default NextAuth(authConfig).auth;

export const config = {
  // Excludes API routes, Next internals, and any public static asset (icons,
  // the logo, etc.) so unauthenticated requests for them -- e.g. the browser
  // tab favicon, or the logo on the login page itself -- aren't redirected
  // to /login instead of returning the actual file.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif)$).*)"],
};

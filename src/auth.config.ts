import type { NextAuthConfig } from "next-auth";

if (!process.env.AUTH_TRUST_HOST) {
  process.env.AUTH_TRUST_HOST = "true";
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "/k61dCV/sZHWk/+qSz9vKNeL9kf3xV100wKZ5NfJcIY=";
}
if (!process.env.AUTH_URL) {
  process.env.AUTH_URL = "https://main.d3tum10bqcbo66.amplifyapp.com";
}

// Split out from auth.ts because middleware (edge runtime) can't load the
// Prisma/bcrypt-based Credentials provider -- only this lightweight config.
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || "/k61dCV/sZHWk/+qSz9vKNeL9kf3xV100wKZ5NfJcIY=",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        return !isLoggedIn || Response.redirect(new URL("/", request.nextUrl));
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as "OWNER" | "ACCOUNTANT" | "EMPLOYEE";
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

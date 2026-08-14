import type { DefaultSession } from "next-auth";

type AppRole = "OWNER" | "ACCOUNTANT" | "EMPLOYEE";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    mustChangePassword: boolean;
  }
}

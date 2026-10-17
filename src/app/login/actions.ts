"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error: any) {
    const isRedirect =
      error?.digest?.startsWith?.("NEXT_REDIRECT") ||
      error?.message === "NEXT_REDIRECT";
    if (isRedirect) {
      throw error;
    }

    if (
      error instanceof AuthError ||
      error?.type === "CredentialsSignin" ||
      error?.name === "CredentialsSignin" ||
      error?.code === "credentials"
    ) {
      return "Invalid email or password.";
    }

    console.error("Login action error:", error);
    return "Invalid email or password.";
  }
}

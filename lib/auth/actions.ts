"use server";

import { signIn, signOut } from "@/auth";

function safeRedirectPath(value: FormDataEntryValue | null): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  return "/dashboard";
}

export async function signInWithDiscord(formData: FormData): Promise<void> {
  await signIn("discord", {
    redirectTo: safeRedirectPath(formData.get("callbackUrl")),
  });
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

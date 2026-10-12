"use client";
import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, twoFactorClient, usernameClient } from "better-auth/client/plugins";

/** Browser auth client. Use for sign-in/up/out and session hooks in client components. */
export const authClient = createAuthClient({
  plugins: [adminClient(), usernameClient(), emailOTPClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

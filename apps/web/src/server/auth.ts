import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP, twoFactor, username } from "better-auth/plugins";
import { getDb, schema } from "@mufasa/db";
import { brand } from "@mufasa/config/brand";
import { env, isConfigured } from "@/env";
import { sendEmail } from "./email";

/**
 * Better Auth. Created lazily because it needs the database, which may not be
 * configured yet (the app must still build and serve public pages).
 *
 * Roles: admin | tutor | parent | student (stored in user.role via the admin plugin).
 * Children: created by their parent with username + PIN (see dal/family.ts),
 * a synthetic email `<id>@kids.invalid` and isManagedChild = true.
 */
function createAuth() {
  const e = env();
  return betterAuth({
    appName: brand.name,
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // 6-digit PINs for children; adults are nudged to longer passwords in the UI.
      minPasswordLength: 6,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    socialProviders: isConfigured("google")
      ? { google: { clientId: e.GOOGLE_CLIENT_ID!, clientSecret: e.GOOGLE_CLIENT_SECRET! } }
      : undefined,
    user: {
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "en", input: true },
        timezone: { type: "string", required: false, defaultValue: "Europe/Istanbul", input: true },
        isManagedChild: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/username": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/forget-password/email-otp": { window: 60, max: 3 },
      },
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
    },
    plugins: [
      admin({ defaultRole: "student", adminRoles: ["admin"] }),
      username({ minUsernameLength: 3, maxUsernameLength: 30 }),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp, type }) {
          const subject =
            type === "forget-password" ? `${brand.name}: password reset code` : `${brand.name}: your verification code`;
          await sendEmail({
            to: email,
            subject,
            text: `Your code is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your code is <strong style="font-size:20px;letter-spacing:4px">${otp}</strong></p><p>It expires in 10 minutes.</p>`,
          });
        },
      }),
      twoFactor({ issuer: brand.name }),
      nextCookies(), // must be last
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as unknown as { __mufasaAuth?: Auth };

export function getAuth(): Auth {
  g.__mufasaAuth ??= createAuth();
  return g.__mufasaAuth;
}

export type AuthSession = Auth["$Infer"]["Session"];

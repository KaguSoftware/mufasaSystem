import * as Sentry from "@sentry/node";

/** Initialised only when SENTRY_DSN is set; otherwise every Sentry call is a no-op. */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    serverName: process.env.HOSTNAME ?? "render-worker",
  });
}

export { Sentry };

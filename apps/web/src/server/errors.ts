export const ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation",
  "conflict",
  "rate_limited",
  "no_access",
  "feature_disabled",
  "db_not_configured",
  "integration_not_configured",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Throw from DAL / services. The action wrapper turns it into a typed ActionResult. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const unauthorized = (m?: string) => new AppError("unauthorized", m);
export const forbidden = (m?: string) => new AppError("forbidden", m);
export const notFound = (m?: string) => new AppError("not_found", m);
export const conflict = (m?: string) => new AppError("conflict", m);

/** Maps an error code to its message key in messages/*.ts (namespace "errors"). */
export const errorMessageKey: Record<ErrorCode, string> = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  not_found: "notFound",
  validation: "validation",
  conflict: "generic",
  rate_limited: "rateLimited",
  no_access: "noAccess",
  feature_disabled: "featureDisabled",
  db_not_configured: "dbNotConfigured",
  integration_not_configured: "integrationNotConfigured",
  internal: "generic",
};

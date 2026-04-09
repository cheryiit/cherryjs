import { ConvexError } from "convex/values";

// JSON-serializable value type — compatible with Convex's `Value` so it can
// be transported in a ConvexError. Avoids `unknown` which fails type-checking
// against ConvexError's data constraint.
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ErrorDetails = Record<string, JsonValue>;

export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  VALIDATION: "VALIDATION",
  BAD_REQUEST: "BAD_REQUEST",
  UNPROCESSABLE: "UNPROCESSABLE",
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  DEPENDENCY_FAILED: "DEPENDENCY_FAILED",
  INTERNAL: "INTERNAL",
  MAINTENANCE: "MAINTENANCE",
  CUSTOM: "CUSTOM",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppError = {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
  details?: ErrorDetails;
};

export const errors = {
  unauthenticated: (message = "Authentication required") =>
    new ConvexError<AppError>({ code: ErrorCode.UNAUTHENTICATED, message }),

  forbidden: (message = "Access denied") =>
    new ConvexError<AppError>({ code: ErrorCode.FORBIDDEN, message }),

  notFound: (resource = "Resource", id?: string) =>
    new ConvexError<AppError>({
      code: ErrorCode.NOT_FOUND,
      message: id ? `${resource} not found: ${id}` : `${resource} not found`,
    }),

  alreadyExists: (resource: string, field?: string) =>
    new ConvexError<AppError>({
      code: ErrorCode.ALREADY_EXISTS,
      message: field
        ? `${resource} already exists with this ${field}`
        : `${resource} already exists`,
    }),

  validation: (message: string, details?: ErrorDetails) =>
    new ConvexError<AppError>({
      code: ErrorCode.VALIDATION,
      message,
      details,
    }),

  rateLimited: (retryAfter?: number) =>
    new ConvexError<AppError>({
      code: ErrorCode.RATE_LIMITED,
      message: retryAfter
        ? `Too many requests. Retry after ${Math.ceil(retryAfter / 1000)}s`
        : "Too many requests",
      retryAfter,
    }),

  conflict: (resource: string, reason?: string) =>
    new ConvexError<AppError>({
      code: ErrorCode.CONFLICT,
      message: reason
        ? `${resource} conflict: ${reason}`
        : `${resource} conflict — another operation is in progress`,
    }),

  badRequest: (message: string, details?: ErrorDetails) =>
    new ConvexError<AppError>({
      code: ErrorCode.BAD_REQUEST,
      message,
      details,
    }),

  unprocessable: (message: string, details?: ErrorDetails) =>
    new ConvexError<AppError>({
      code: ErrorCode.UNPROCESSABLE,
      message,
      details,
    }),

  quotaExceeded: (resource: string, limit?: number) =>
    new ConvexError<AppError>({
      code: ErrorCode.QUOTA_EXCEEDED,
      message: limit
        ? `${resource} quota exceeded (limit: ${limit})`
        : `${resource} quota exceeded`,
    }),

  dependencyFailed: (dependency: string, message?: string) =>
    new ConvexError<AppError>({
      code: ErrorCode.DEPENDENCY_FAILED,
      message: message
        ? `${dependency} failed: ${message}`
        : `${dependency} is unavailable`,
    }),

  internal: (message = "Internal error") =>
    new ConvexError<AppError>({ code: ErrorCode.INTERNAL, message }),

  maintenance: (message = "System is in maintenance mode") =>
    new ConvexError<AppError>({ code: ErrorCode.MAINTENANCE, message }),

  custom: (code: string, message: string, details?: ErrorDetails) =>
    new ConvexError<AppError>({
      code: ErrorCode.CUSTOM,
      message,
      details: { ...details, customCode: code },
    }),
};

export function isAppError(error: unknown): error is ConvexError<AppError> {
  return (
    error instanceof ConvexError &&
    typeof (error as ConvexError<AppError>).data?.code === "string" &&
    Object.values(ErrorCode).includes(
      (error as ConvexError<AppError>).data.code,
    )
  );
}

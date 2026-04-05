import { ConvexError } from "convex/values";

export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  VALIDATION: "VALIDATION",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
  MAINTENANCE: "MAINTENANCE",
  CUSTOM: "CUSTOM",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppError = {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
  details?: Record<string, unknown>;
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

  validation: (message: string, details?: Record<string, unknown>) =>
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

  internal: (message = "Internal error") =>
    new ConvexError<AppError>({ code: ErrorCode.INTERNAL, message }),

  maintenance: (message = "System is in maintenance mode") =>
    new ConvexError<AppError>({ code: ErrorCode.MAINTENANCE, message }),

  custom: (code: string, message: string, details?: Record<string, unknown>) =>
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

/**
 * Convex client-side helpers.
 *
 * Provides typed hooks and utilities for Convex integration
 * with TanStack Query.
 */
export {
  useQuery,
  useMutation,
  useAction,
  usePaginatedQuery,
} from "convex/react";

export { useConvexQuery, useConvexMutation } from "@convex-dev/react-query";

export { api, internal } from "../../convex/_generated/api";

/**
 * Extract meaningful error message from Convex errors.
 * Convex wraps errors in "[CONVEX ...] Error: actual message" format.
 */
export function extractConvexError(error: unknown): string {
  if (error instanceof Error) {
    const match = error.message.match(/Error: (.+?)(?:\s+at\s+|$)/);
    return match ? match[1]! : error.message;
  }
  return String(error);
}

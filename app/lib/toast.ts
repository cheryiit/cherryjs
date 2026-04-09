import { toast } from "sonner";

/**
 * Wraps an async operation with automatic toast feedback.
 *
 * Usage:
 * ```ts
 * await withToast(
 *   () => updateProfile({ name }),
 *   { loading: "Saving...", success: "Saved", error: "Failed to save" }
 * );
 * ```
 */
export async function withToast<T>(
  fn: () => Promise<T>,
  messages: {
    loading?: string;
    success?: string;
    error?: string;
  } = {},
): Promise<T> {
  const promise = fn();
  toast.promise(promise, {
    loading: messages.loading ?? "Loading...",
    success: messages.success ?? "Done",
    error: (err) =>
      messages.error ??
      (err instanceof Error ? err.message : "Something went wrong"),
  });
  return promise;
}

export { toast } from "sonner";

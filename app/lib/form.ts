import { useForm, type FormOptions } from "@tanstack/react-form";
import { toast } from "sonner";
import type { z } from "zod";

/**
 * Creates a form with built-in toast feedback and Zod validation.
 *
 * Usage:
 * ```tsx
 * const form = useCherryForm({
 *   schema: z.object({ email: z.string().email() }),
 *   defaultValues: { email: "" },
 *   onSubmit: async (values) => { await createUser(values) },
 *   successMessage: "User created",
 * });
 * ```
 */
export function useCherryForm<TValues extends Record<string, unknown>>(opts: {
  defaultValues: TValues;
  onSubmit: (values: TValues) => Promise<void>;
  schema?: z.ZodSchema<TValues>;
  successMessage?: string;
  errorMessage?: string;
}) {
  return useForm({
    defaultValues: opts.defaultValues,
    validators: opts.schema
      ? { onSubmit: opts.schema as any }
      : undefined,
    onSubmit: async ({ value }) => {
      try {
        await opts.onSubmit(value as TValues);
        if (opts.successMessage) toast.success(opts.successMessage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        toast.error(opts.errorMessage ?? message);
        throw error;
      }
    },
  } satisfies FormOptions<TValues>);
}

export { useForm } from "@tanstack/react-form";

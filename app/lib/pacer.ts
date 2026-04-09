/**
 * TanStack Pacer — debounce, throttle, batch hooks.
 *
 * Use cases:
 * - Search inputs (debounce: wait until user stops typing)
 * - Scroll handlers (throttle: cap firing rate)
 * - Autosave (debounce: save 1s after last edit)
 * - Bulk mutations (batch: collect items, fire once)
 *
 * Usage:
 * ```tsx
 * // Debounced search
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebouncedValue(query, { wait: 300 });
 *
 * // Throttled callback
 * const throttledScroll = useThrottledCallback(
 *   (e) => trackScroll(e),
 *   { wait: 100 }
 * );
 * ```
 */
export {
  useDebouncedValue,
  useDebouncedCallback,
  useDebouncedState,
  useThrottledValue,
  useThrottledCallback,
  useThrottledState,
  useRateLimitedCallback,
  useBatcher,
  useAsyncBatcher,
} from "@tanstack/react-pacer";

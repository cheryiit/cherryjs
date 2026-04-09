/**
 * TanStack Virtual — typed wrapper for virtualized rendering.
 * Use for long lists (1000+ items), infinite scrolls, large tables.
 *
 * Usage:
 * ```tsx
 * const parentRef = useRef<HTMLDivElement>(null);
 * const virtualizer = useCherryVirtual({
 *   count: items.length,
 *   parentRef,
 *   estimateSize: () => 48,
 * });
 *
 * return (
 *   <div ref={parentRef} className="h-[600px] overflow-auto">
 *     <div style={{ height: virtualizer.getTotalSize() }}>
 *       {virtualizer.getVirtualItems().map((vi) => (
 *         <div key={vi.key} style={{
 *           position: "absolute", top: 0, left: 0, width: "100%",
 *           height: vi.size, transform: `translateY(${vi.start}px)`,
 *         }}>
 *           {items[vi.index]?.name}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 * ```
 */
import { useVirtualizer, type VirtualizerOptions } from "@tanstack/react-virtual";
import type { RefObject } from "react";

export function useCherryVirtual(opts: {
  count: number;
  parentRef: RefObject<HTMLElement | null>;
  estimateSize: (index: number) => number;
  overscan?: number;
  horizontal?: boolean;
}) {
  return useVirtualizer({
    count: opts.count,
    getScrollElement: () => opts.parentRef.current,
    estimateSize: opts.estimateSize,
    overscan: opts.overscan ?? 5,
    horizontal: opts.horizontal ?? false,
  });
}

export { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";

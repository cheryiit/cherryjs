/**
 * TanStack Store — typed wrapper for client-only reactive state.
 *
 * USE FOR:
 * - Multi-step form drafts (data not yet sent to server)
 * - UI state shared across components (sidebar collapsed, modal stack)
 * - Filter/sort/wizard state too complex for search params
 * - Undo/redo stacks, ephemeral UI state
 *
 * DO NOT USE FOR:
 * - Server data (use Convex queries — they're already reactive)
 * - User session / auth state (use Better-Auth)
 * - Form values being submitted (use useCherryForm)
 * - Persistent settings (use Convex parameters table)
 *
 * Usage:
 * ```ts
 * // 1. Define a typed store
 * export const draftStore = createCherryStore({
 *   name: "",
 *   email: "",
 *   step: 0 as 0 | 1 | 2,
 * });
 *
 * // 2. Read in component (granular — only re-renders on selected slice change)
 * function NameField() {
 *   const name = useStoreSelector(draftStore, (s) => s.name);
 *   return <Input value={name} onChange={(e) =>
 *     draftStore.setState((s) => ({ ...s, name: e.target.value }))
 *   } />;
 * }
 * ```
 */
import { Store, useStore } from "@tanstack/react-store";

export function createCherryStore<TState>(initial: TState): Store<TState> {
  return new Store<TState>(initial);
}

/**
 * Subscribe to a slice of a store. Component re-renders only when
 * the selected slice changes (not the whole store).
 */
export function useStoreSelector<TState, TSlice>(
  store: Store<TState>,
  selector: (state: TState) => TSlice,
): TSlice {
  return useStore(store, selector);
}

export { Store, useStore } from "@tanstack/react-store";

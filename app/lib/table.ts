/**
 * TanStack Table — typed wrapper.
 *
 * Usage:
 * ```tsx
 * import { useCherryTable } from "~/app/lib/table";
 *
 * const columns: TableColumn<User>[] = [
 *   { accessorKey: "name", header: "Name" },
 *   { accessorKey: "email", header: "Email" },
 * ];
 *
 * const table = useCherryTable({ data: users, columns });
 *
 * return <Table table={table} />; // see app/components/ui/table.tsx
 * ```
 */
import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
import { useState } from "react";

export type TableColumn<TData> = ColumnDef<TData, any>;

export function useCherryTable<TData>(opts: {
  data: TData[];
  columns: TableColumn<TData>[];
  initialPageSize?: number;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: opts.initialPageSize ?? 20,
  });

  const table = useReactTable({
    data: opts.data,
    columns: opts.columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    ...(opts.enableSorting !== false && { getSortedRowModel: getSortedRowModel() }),
    ...(opts.enableFiltering !== false && { getFilteredRowModel: getFilteredRowModel() }),
    ...(opts.enablePagination !== false && { getPaginationRowModel: getPaginationRowModel() }),
  });

  return table;
}

export {
  flexRender,
  type Table as TanStackTable,
  type Row,
  type Cell,
  type Header,
} from "@tanstack/react-table";

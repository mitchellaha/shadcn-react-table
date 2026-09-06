import type { RowData, Table } from "@tanstack/react-table"

import type { DataTableFeatures } from "./table-features"
import type { DataTableInstance } from "./types"

/**
 * Resolves the enriched instance from whichever table object is at hand.
 *
 * `useTable` returns a spread copy of the core table, so `table.tableInstance`
 * and `table.state` exist only on that wrapper. The `table` handed to a cell /
 * header renderer (`cell.getContext().table`, `header.getContext().table`,
 * `row.table`, `column.table`) is the *core* table and has neither. Both share
 * one options object, so the ref the hook parks on `options.meta` bridges them.
 *
 * Call this at every site where `table` arrives from a TanStack context, then
 * use the result exactly as `table` was used before.
 */
export function resolveDataTable<TData extends RowData>(
  table: Table<DataTableFeatures, TData> | DataTableInstance<TData>
): DataTableInstance<TData> {
  const instance = table.options.meta?.dataTableRef?.current
  if (instance == null) {
    throw new Error("resolveDataTable: table was not created by useDataTable")
  }
  return instance
}

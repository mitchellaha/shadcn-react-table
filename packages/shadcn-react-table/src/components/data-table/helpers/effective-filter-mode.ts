import type { RowData } from "@tanstack/react-table"

import type { DataTableColumn, DataTableInstance } from "../core/types"
import { defaultModeForVariant, type FilterMode } from "../fns/filter-fns"

/** Effective filter mode for a column: explicit selection → meta → variant default. */
export function getEffectiveMode<TData extends RowData, TValue>(
  column: DataTableColumn<TData, TValue>,
  table: DataTableInstance<TData>
): FilterMode {
  const variant = column.columnDef.meta?.variant ?? "text"
  return (
    table.tableInstance.columnFilterModes[column.id] ??
    column.columnDef.meta?.filterMode ??
    defaultModeForVariant(variant)
  )
}

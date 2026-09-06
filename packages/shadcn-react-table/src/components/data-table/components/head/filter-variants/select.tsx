"use client"

import type { RowData } from "@tanstack/react-table"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

import { getColumnLabel } from "../../../helpers/column-label"
import { FIELD_CLASS, useSelectOptions, type FilterFieldProps } from "./shared"

export function SelectFilterField<TData extends RowData, TValue>({
  column,
  table,
}: FilterFieldProps<TData, TValue>) {
  const { localization, icons } = table.tableInstance
  const { options } = useSelectOptions(column)
  const value = (column.getFilterValue() as string) || ""
  return (
    <div className="flex items-center gap-1">
      <Select
        // Always controlled: "" shows the placeholder, while `undefined` would
        // flip to uncontrolled and go stale.
        value={value}
        // Base UI's SelectValue renders the raw value unless the root knows the
        // items; without this a label that differs from its value never shows.
        items={options}
        onValueChange={(next) => column.setFilterValue(next || undefined)}
      >
        <SelectTrigger
          size="sm"
          className={cn(FIELD_CLASS, "w-full min-w-0 flex-1 px-2")}
          aria-label={localization.filterByColumn(getColumnLabel(column))}
        >
          <SelectValue
            placeholder={localization.filterPlaceholder(getColumnLabel(column))}
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={localization.clearFilter}
          onClick={() => column.setFilterValue(undefined)}
          className="size-7"
        >
          <icons.clear />
        </Button>
      )}
    </div>
  )
}

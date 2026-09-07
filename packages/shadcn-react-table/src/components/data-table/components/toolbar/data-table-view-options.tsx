"use client"

import type { RowData } from "@tanstack/react-table"

import { buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import type { DataTableInstance } from "../../core/types"
import { getColumnLabel } from "../../helpers/column-label"

/**
 * Column visibility menu (toolbar icon cluster). Lists every hideable column
 * as a checkbox item; the header `label`/string is used for the menu text.
 */
export function DataTableViewOptions<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>
}) {
  const { localization, icons } = table.tableInstance
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  if (hideableColumns.length === 0) return null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              aria-label={localization.columnVisibility}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "size-8"
              )}
            />
          }
        >
          <icons.columnVisibility />
        </TooltipTrigger>
        <TooltipContent>{localization.columnVisibility}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        {/* Base UI's GroupLabel requires a Group ancestor; Radix renders the
            group as an inert wrapper. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{localization.columnVisibility}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {hideableColumns.map((column) => (
          // Base UI checkbox items default to `closeOnClick={false}`, so the
          // menu stays open while several columns are toggled.
          <DropdownMenuCheckboxItem
            key={column.id}
            className="capitalize"
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          >
            {getColumnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

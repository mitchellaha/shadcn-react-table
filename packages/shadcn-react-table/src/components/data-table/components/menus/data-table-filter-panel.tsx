"use client"

import type { RowData } from "@tanstack/react-table"
import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type {
  AdvancedFilterGroup,
  AdvancedFilterOperator,
  AdvancedFilterRule,
  DataTableColumn,
  DataTableInstance,
  FilterVariant,
  DataTableFilterOption,
} from "../../core/types"
import {
  getOperatorsForVariant,
  isValuelessOperator,
} from "../../fns/advanced-filter"
import { getColumnLabel } from "../../helpers/column-label"

// Monotonic ids for new rules. Panel is client-only, so a module counter is
// stable enough (and avoids crypto/uuid deps).
let ruleSeq = 0
const nextRuleId = () => `cn-adv-rule-${++ruleSeq}`

// Base UI's SelectValue renders the raw value unless the Select root gets
// `items`, so every select below feeds its option list to both.
const BOOLEAN_ITEMS = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
]

function columnVariant<TData extends RowData>(
  column: DataTableColumn<TData, unknown> | undefined
): FilterVariant {
  return column?.columnDef.meta?.variant ?? "text"
}

function valueInputType(variant: FilterVariant): "text" | "number" | "date" {
  if (variant === "range" || variant === "range-slider") return "number"
  if (variant === "date" || variant === "date-range") return "date"
  return "text"
}

type Localization<TData extends RowData> =
  DataTableInstance<TData>["tableInstance"]["localization"]

/**
 * Modal dialog for building compound AND/OR filter rules. Edits accumulate in a
 * local draft and are only committed when "Apply" is clicked — closing or
 * cancelling discards them. The body is mounted only while open, so the draft
 * is freshly seeded from the active filter each time the dialog opens.
 */
export function DataTableFilterPanel<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>
}) {
  const { showAdvancedFilterPanel, setShowAdvancedFilterPanel } =
    table.tableInstance
  return (
    <Dialog
      open={showAdvancedFilterPanel}
      onOpenChange={setShowAdvancedFilterPanel}
    >
      {showAdvancedFilterPanel && <FilterPanelContent table={table} />}
    </Dialog>
  )
}

function FilterPanelContent<TData extends RowData>({
  table,
}: {
  table: DataTableInstance<TData>
}) {
  const {
    localization,
    icons,
    advancedFilter,
    setAdvancedFilter,
    setShowAdvancedFilterPanel,
  } = table.tableInstance

  // Seeded once on mount (the dialog body remounts each open).
  const [draft, setDraft] = React.useState<AdvancedFilterGroup>(advancedFilter)

  const { logic, rules } = draft
  const columns = table.getAllLeafColumns().filter((c) => c.getCanFilter())
  const columnItems: DataTableFilterOption[] = columns.map((c) => ({
    value: c.id,
    label: getColumnLabel(c),
  }))
  const logicItems: DataTableFilterOption[] = [
    { value: "all", label: localization.advancedFiltersMatchAll },
    { value: "any", label: localization.advancedFiltersMatchAny },
  ]

  const updateRule = (id: string, patch: Partial<AdvancedFilterRule>) =>
    setDraft((group) => ({
      ...group,
      rules: group.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))

  const addRule = () => {
    const column = columns[0]
    if (!column) return
    const operator =
      getOperatorsForVariant(columnVariant(column))[0] ?? "contains"
    setDraft((group) => ({
      ...group,
      rules: [
        ...group.rules,
        { id: nextRuleId(), columnId: column.id, operator, value: undefined },
      ],
    }))
  }

  const removeRule = (id: string) =>
    setDraft((group) => ({
      ...group,
      rules: group.rules.filter((r) => r.id !== id),
    }))

  const clearAll = () => setDraft((group) => ({ ...group, rules: [] }))

  const apply = () => {
    setAdvancedFilter(draft)
    setShowAdvancedFilterPanel(false)
  }

  // Changing the column may invalidate the operator/value, so reconcile both.
  const changeColumn = (rule: AdvancedFilterRule, columnId: string) => {
    const operators = getOperatorsForVariant(
      columnVariant(table.getColumn(columnId))
    )
    const operator = operators.includes(rule.operator)
      ? rule.operator
      : (operators[0] ?? "contains")
    updateRule(rule.id, {
      columnId,
      operator,
      value: undefined,
      value2: undefined,
    })
  }

  const changeOperator = (
    rule: AdvancedFilterRule,
    operator: AdvancedFilterOperator
  ) =>
    updateRule(
      rule.id,
      isValuelessOperator(operator)
        ? { operator, value: undefined, value2: undefined }
        : { operator }
    )

  return (
    <DialogContent className="gap-3 sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{localization.advancedFilters}</DialogTitle>
        <DialogDescription className="sr-only">
          {localization.advancedFilters}
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {localization.advancedFiltersMatchLabel}
          </span>
          <Select
            value={logic === "or" ? "any" : "all"}
            items={logicItems}
            onValueChange={(v) =>
              setDraft((group) => ({
                ...group,
                logic: v === "any" ? "or" : "and",
              }))
            }
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {logicItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">
            {localization.advancedFiltersOf}
          </span>
        </div>

        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {localization.advancedFiltersEmpty}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => {
              const column = table.getColumn(rule.columnId)
              const variant = columnVariant(column)
              const operatorItems = getOperatorsForVariant(variant).map(
                (op) => ({
                  value: op,
                  label: localization.advancedFilterOperators[op] ?? op,
                })
              )
              return (
                <div
                  key={rule.id}
                  className="flex flex-col gap-2 rounded-md border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Select
                      value={rule.columnId}
                      items={columnItems}
                      // Base UI's Select emits null for a cleared value; a rule
                      // always needs a column, so ignore it.
                      onValueChange={(v) => {
                        if (v != null) changeColumn(rule, v)
                      }}
                    >
                      <SelectTrigger className="h-8 flex-1">
                        <SelectValue
                          placeholder={localization.advancedFiltersColumn}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {columnItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label={localization.removeFilterRule}
                      onClick={() => removeRule(rule.id)}
                    >
                      <icons.clear />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={rule.operator}
                      items={operatorItems}
                      onValueChange={(v) =>
                        changeOperator(rule, v as AdvancedFilterOperator)
                      }
                    >
                      <SelectTrigger className="h-8 w-40 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <RuleValueInput
                      rule={rule}
                      variant={variant}
                      column={column}
                      localization={localization}
                      onChange={(patch) => updateRule(rule.id, patch)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={addRule}
          disabled={columns.length === 0}
        >
          {localization.advancedFiltersAddRule}
        </Button>
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          disabled={rules.length === 0}
        >
          {localization.advancedFiltersClearAll}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilterPanel(false)}
          >
            {localization.cancel}
          </Button>
          <Button size="sm" onClick={apply}>
            {localization.advancedFiltersApply}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  )
}

function RuleValueInput<TData extends RowData>({
  rule,
  variant,
  column,
  localization,
  onChange,
}: {
  rule: AdvancedFilterRule
  variant: FilterVariant
  column: DataTableColumn<TData, unknown> | undefined
  localization: Localization<TData>
  onChange: (patch: Partial<AdvancedFilterRule>) => void
}) {
  if (isValuelessOperator(rule.operator)) return null

  const options = column?.columnDef.meta?.options
  if ((variant === "select" || variant === "multi-select") && options?.length) {
    return (
      <Select
        value={(rule.value as string | undefined) ?? ""}
        items={options}
        onValueChange={(v) => onChange({ value: v })}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder={localization.advancedFiltersValue} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (variant === "checkbox") {
    return (
      <Select
        value={rule.value === undefined ? "" : String(rule.value)}
        items={BOOLEAN_ITEMS}
        onValueChange={(v) => onChange({ value: v === "true" })}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder={localization.advancedFiltersValue} />
        </SelectTrigger>
        <SelectContent>
          {BOOLEAN_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const type = valueInputType(variant)
  if (rule.operator === "between") {
    return (
      <div className="flex flex-1 items-center gap-1">
        <Input
          type={type}
          className="h-8"
          value={(rule.value as string | undefined) ?? ""}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={localization.min}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type={type}
          className="h-8"
          value={(rule.value2 as string | undefined) ?? ""}
          onChange={(e) => onChange({ value2: e.target.value })}
          placeholder={localization.max}
        />
      </div>
    )
  }

  return (
    <Input
      type={type}
      className="h-8 flex-1"
      value={(rule.value as string | undefined) ?? ""}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={localization.advancedFiltersValue}
    />
  )
}

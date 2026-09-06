"use client"

import { useTable, type RowData } from "@tanstack/react-table"
import * as React from "react"

import { VALUELESS_MODES, type FilterMode } from "../fns/filter-fns"
import { columnKey } from "../helpers/column-key"
import { getColumnLabel } from "../helpers/column-label"
import {
  getColumnDefMinWidth,
  getColumnDefPreferredWidth,
  getHeaderControlsWidth,
  isDataColumnDef,
  type HeaderControlsOptions,
} from "../helpers/header-controls"
import { measureColumnWidth } from "../helpers/measure-column-width"
import { useAdvancedFilter } from "../hooks/use-advanced-filter"
import { useColumnFilterModes } from "../hooks/use-column-filter-modes"
import { useControllableState } from "../hooks/use-controllable-state"
import { useEditingState } from "../hooks/use-editing-state"
import { useGlobalFilterMode } from "../hooks/use-global-filter-mode"
import { usePageResetOnFilterChange } from "../hooks/use-page-reset-on-filter-change"
import { useResolvedColumns } from "../hooks/use-resolved-columns"
import { useDataTableConfigContext } from "./config-context"
import { defaultIcons } from "./icons"
import { defaultLocalization } from "./localization"
import { dataTableFeatures, type DataTableFeatures } from "./table-features"
import type {
  DataTableConfig,
  DataTableInstance,
  Density,
  UseDataTableOptions,
} from "./types"

/**
 * Core hook. Wraps `useTable` with MRT-flavoured defaults (features/row models,
 * auto-injected selection column, localization) and attaches our presentation
 * state + feature flags to the instance as `table.tableInstance`. Returns the
 * enriched instance to hand to `<DataTable table={table} />`.
 *
 * Controlled data state (sorting/filtering/pagination/selection/visibility),
 * `manual*` server-side flags, and `getRowId` all pass straight through to
 * TanStack via the spread options. The presentation state is split into focused
 * hooks (`use-editing-state`, `use-column-filter-modes`, `use-global-filter-mode`,
 * `use-resolved-columns`, `use-page-reset-on-filter-change`); this hook wires
 * them together and assembles the `tableInstance` config.
 */
export function useDataTable<TData extends RowData>(
  options: UseDataTableOptions<TData>
): DataTableInstance<TData> {
  const {
    localization: localizationProp,
    icons: iconsProp,
    defaultDensity = "comfortable",
    defaultShowColumnFilters = false,
    isLoading = false,
    isSaving = false,
    showProgressBars: showProgressBarsProp,
    showSkeletons: showSkeletonsProp,
    showLoadingOverlay: showLoadingOverlayProp,
    enableFacetedValues = true,
    enableColumnActions = true,
    enableStickyHeader = true,
    enablePagination: enablePaginationProp = true,
    enableInfiniteScroll = false,
    onLoadMore,
    hasNextPage = false,
    isFetchingNextPage = false,
    infiniteScrollThreshold = 200,
    positionPagination = "bottom",
    paginationDisplayMode = "default",
    columnFilterDisplayMode = "subheader",
    positionGlobalFilter = "right",
    positionToolbarAlertBanner = "top",
    positionToolbarDropZone = "top",
    positionActionsColumn = "last",
    positionExpandColumn = "first",
    selectAllMode = "page",
    enableSelectAll = true,
    enableTopToolbar = true,
    enableBottomToolbar = true,
    enableDensityToggle = true,
    enableFullscreenToggle = true,
    enableKeyboardNavigation = true,
    enableColumnFilterModes = true,
    enableFilterMatchHighlighting = true,
    enableGlobalFilter = true,
    enableGlobalFilterModes = true,
    enableGlobalFilterRankedResults = false,
    defaultGlobalFilterMode = "fuzzy",
    density: densityProp,
    onDensityChange,
    isFullscreen: isFullscreenProp,
    onIsFullscreenChange,
    showColumnFilters: showColumnFiltersProp,
    onShowColumnFiltersChange,
    enableAdvancedFilter = false,
    advancedFilter: advancedFilterProp,
    defaultAdvancedFilter,
    onAdvancedFilterChange,
    globalFilterMode: globalFilterModeProp,
    onGlobalFilterModeChange,
    enableColumnOrdering = false,
    enableColumnPinning = false,
    enableColumnResizing = false,
    enableColumnAutosize: enableColumnAutosizeProp,
    enableRowOrdering = false,
    enableRowPinning = false,
    enableRowNumbers = false,
    rowNumberMode = "static",
    onRowOrderChange,
    enableGrouping = false,
    enableExpanding: enableExpandingProp,
    enableStickyFooter = false,
    renderDetailPanel,
    enableEditing = false,
    editDisplayMode = "cell",
    createDisplayMode = "modal",
    createRowDefaults,
    enableClickToCopy = false,
    onEditCellSave,
    onSaveRow,
    onCreateRow,
    renderRowActions,
    renderCellActionMenuItems,
    renderRowActionMenuItems,
    renderColumnActionsMenuItems,
    renderColumnFilterModeMenuItems,
    renderGlobalFilterModeMenuItems,
    renderCaption,
    onRowClick,
    onRowDoubleClick,
    onCellClick,
    onCellDoubleClick,
    enableRowVirtualization = false,
    enableColumnVirtualization = false,
    estimateRowHeight = 52,
    virtualOverscan = 8,
    rowHeight,
    getRowHeight,
    rowVirtualizerOptions,
    columnVirtualizerOptions,
    rowVirtualizerInstanceRef,
    columnVirtualizerInstanceRef,
    enableToolbarInternalActions = true,
    title,
    renderToolbarActions,
    renderTopToolbar,
    renderBottomToolbar,
    renderToolbarInternalActions,
    renderBottomToolbarCustomActions,
    renderEmpty,
    columns,
    ...tableOptions
  } = options

  // Infinite scroll implies a single growing page: hide the pager and drop the
  // pagination row model so every appended row renders.
  const enablePagination = enableInfiniteScroll ? false : enablePaginationProp

  // App-wide defaults from a surrounding DataTableConfigProvider (if any) sit
  // between the built-in defaults and per-call options.
  const configCtx = useDataTableConfigContext()
  const localization = React.useMemo(
    () => ({
      ...defaultLocalization,
      ...configCtx.localization,
      ...localizationProp,
    }),
    [configCtx.localization, localizationProp]
  )
  const icons = React.useMemo(
    () => ({ ...defaultIcons, ...configCtx.icons, ...iconsProp }),
    [configCtx.icons, iconsProp]
  )

  // Expansion turns on for tree data (getSubRows), detail panels, or grouping.
  const enableExpanding =
    enableExpandingProp ??
    (!!renderDetailPanel || !!tableOptions.getSubRows || enableGrouping)
  // An expand column is needed for tree sub-rows or detail panels (grouped
  // rows carry their own chevron in the grouping cell).
  const needsExpandColumn = !!renderDetailPanel || !!tableOptions.getSubRows

  // Loading affordances: each can be forced on/off, else derived from the
  // loading/saving flags (progress bar for either; skeletons + overlay only
  // for the initial data load).
  const showProgressBars = showProgressBarsProp ?? (isLoading || isSaving)
  const showSkeletons = showSkeletonsProp ?? isLoading
  const showLoadingOverlay = showLoadingOverlayProp ?? isLoading

  const [density, setDensity] = useControllableState<Density>(
    densityProp,
    defaultDensity,
    onDensityChange
  )
  const [isFullscreen, setIsFullscreen] = useControllableState(
    isFullscreenProp,
    false,
    onIsFullscreenChange
  )
  const [showColumnFilters, setShowColumnFilters] = useControllableState(
    showColumnFiltersProp,
    defaultShowColumnFilters,
    onShowColumnFiltersChange
  )

  const {
    editingCell,
    setEditingCell,
    editingRowId,
    isCreating,
    rowDraft,
    setRowDraftValue,
    beginRowEdit,
    beginCreate,
    cancelEdit,
  } = useEditingState<TData>(createRowDefaults)

  const { columnFilterModes, setColumnFilterModes, dynamicFilterFn } =
    useColumnFilterModes<TData>(columns)

  const isManualFiltering = !!tableOptions.manualFiltering

  const {
    globalFilterMode,
    setGlobalFilterMode,
    dynamicGlobalFilterFn,
    rankedSortedRowModel,
  } = useGlobalFilterMode<TData>({
    globalFilterMode: globalFilterModeProp,
    defaultGlobalFilterMode,
    onGlobalFilterModeChange,
    enableGlobalFilterRankedResults,
    manualSorting: !!tableOptions.manualSorting,
    manualFiltering: isManualFiltering,
    enableGrouping,
  })

  const {
    advancedFilter,
    setAdvancedFilter,
    showAdvancedFilterPanel,
    setShowAdvancedFilterPanel,
    advancedFilteredRowModel,
  } = useAdvancedFilter<TData>({
    enableAdvancedFilter,
    advancedFilter: advancedFilterProp,
    defaultAdvancedFilter,
    onAdvancedFilterChange,
  })

  const enableRowSelection =
    tableOptions.enableRowSelection != null
      ? !!tableOptions.enableRowSelection
      : false

  // Columns with a consumer-provided cell renderer are left untouched by
  // auto-highlighting (the consumer owns their markup).
  const columnsWithCustomCell = React.useMemo(() => {
    const set = new Set<string>()
    for (const def of columns) {
      const key = columnKey(def as { id?: string; accessorKey?: unknown })
      if (key && "cell" in def && def.cell != null) set.add(key)
    }
    return set
  }, [columns])

  const resolvedColumns = useResolvedColumns<TData>({
    columns,
    enableRowOrdering,
    enableRowSelection,
    selectAllMode,
    enableSelectAll,
    needsExpandColumn,
    positionExpandColumn,
    enableRowNumbers,
    rowNumberMode,
    enableRowPinning,
    renderRowActions,
    renderRowActionMenuItems,
    positionActionsColumn,
    enableEditing,
    editDisplayMode,
    localization,
    icons,
  })

  // Which header affordances render — shared by the column sizing below, the
  // autosize measurement, and the header components, so they can't diverge.
  const headerControlsOptions = React.useMemo<HeaderControlsOptions>(
    () => ({
      enableColumnActions,
      enableColumnOrdering,
      enableGrouping,
      enableColumnPinning,
      enableColumnVirtualization,
      columnFilterDisplayMode,
    }),
    [
      enableColumnActions,
      enableColumnOrdering,
      enableGrouping,
      enableColumnPinning,
      enableColumnVirtualization,
      columnFilterDisplayMode,
    ]
  )

  // Size each data column so its header controls are never clipped. Under
  // `table-layout: fixed` a `<th>` is pinned to `getSize()` and clips overflow,
  // and CSS `min-width` is ignored — so the drag grip / actions / filter button
  // (all shrink-0) would be hidden behind a long label or a small size.
  //  • minSize — a hard floor (controls + a sliver of label) that raises
  //    `getSize()` and stops the resize drag; the label truncates past it.
  //  • size — the at-rest default, widened to fit the full header so nothing is
  //    truncated until the user drags narrower; only when no size was pinned.
  // Done here as a pure transform (not a post-build mutation) so React Compiler
  // keeps it and the SSR and client size vars match — a mutation in a memo/effect
  // is dead-code-eliminated on the client and desyncs hydration.
  const baseColumnSize = tableOptions.defaultColumn?.size ?? 150
  const sizedColumns = React.useMemo(
    () =>
      resolvedColumns.map((def) => {
        if (!isDataColumnDef(def)) return def
        const minSize = Math.max(
          def.minSize ?? 0,
          getColumnDefMinWidth(def, headerControlsOptions)
        )
        const size =
          def.size != null
            ? def.size
            : Math.max(
                baseColumnSize,
                getColumnDefPreferredWidth(def, headerControlsOptions)
              )
        return { ...def, minSize, size }
      }),
    [resolvedColumns, headerControlsOptions, baseColumnSize]
  )

  // Back-reference for `resolveDataTable`: the callbacks below and every
  // TanStack render context need the enriched instance, which does not exist
  // until `useTable` has run. Parking it on a ref keeps their identities
  // stable and lets `options.meta` carry it into the core table.
  const dataTableRef = React.useRef<DataTableInstance<TData> | null>(null)

  const enableColumnFilters = tableOptions.enableColumnFilters !== false

  // Switching a column's mode resets its value so a stale value (e.g. a
  // numeric range left over from "between") can't break the new mode. Valueless
  // modes (empty/notEmpty) get a truthy sentinel so they stay active. Lives here
  // (not in useColumnFilterModes) because it needs the table instance.
  const setColumnFilterMode = React.useCallback(
    (columnId: string, mode: FilterMode) => {
      setColumnFilterModes((prev) => ({ ...prev, [columnId]: mode }))
      const column = dataTableRef.current?.getColumn(columnId)
      if (!column) return
      column.setFilterValue(VALUELESS_MODES.has(mode) ? mode : undefined)
    },
    [setColumnFilterModes]
  )

  // Structural DOM refs, exposed on `table.tableInstance.refs` and attached to the
  // corresponding elements in DataTable / toolbar / global-filter.
  const tablePaperRef = React.useRef<HTMLDivElement>(null)
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const topToolbarRef = React.useRef<HTMLDivElement>(null)
  const bottomToolbarRef = React.useRef<HTMLDivElement>(null)
  const tableHeadRef = React.useRef<HTMLTableSectionElement>(null)
  const tableFooterRef = React.useRef<HTMLTableSectionElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Double-clicking a resize handle (or calling this imperatively) fits a column
  // to its widest value. Defaults on when resizing is enabled.
  const enableColumnAutosize = enableColumnAutosizeProp ?? enableColumnResizing

  const autoSizeColumn = React.useCallback(
    (columnId: string) => {
      const table = dataTableRef.current
      const column = table?.getColumn(columnId)
      if (!table || !column || !column.getCanResize()) return

      // Font + horizontal padding come from a real rendered cell so measurement
      // matches the actual type scale and density; fall back to sane defaults.
      const containerEl = tableContainerRef.current
      const sampleCell =
        containerEl?.querySelector<HTMLElement>("tbody td") ??
        containerEl?.querySelector<HTMLElement>("thead th") ??
        null
      let font = "14px sans-serif"
      let padding = 24
      if (sampleCell) {
        const cs = getComputedStyle(sampleCell)
        if (cs.font) font = cs.font
        padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      }

      // Measure the full dataset (not just virtualized-visible rows) from raw
      // values. Headers render uppercase, so match that for measurement.
      const values = table.getRowModel().rows.map((row) => {
        const value = row.getValue(columnId)
        return value == null ? "" : String(value)
      })
      const headerText = getColumnLabel(column).toUpperCase()

      // Reserve room beside the label for the header affordances that actually
      // render (sort indicator, drag grip, column-actions trigger, popover
      // filter button). Shared with the per-column minSize floor below so
      // measurement and the floor can never disagree — see helpers/header-controls.
      const extraWidth = getHeaderControlsWidth(column, headerControlsOptions)

      const width = measureColumnWidth(values, headerText, {
        font,
        padding,
        extraWidth,
      })

      // Respect any per-column size bounds from the column def.
      const { minSize, maxSize } = column.columnDef
      let clamped = width
      if (typeof minSize === "number") clamped = Math.max(clamped, minSize)
      if (typeof maxSize === "number") clamped = Math.min(clamped, maxSize)

      table.setColumnSizing((prev) => ({ ...prev, [columnId]: clamped }))
    },
    [headerControlsOptions]
  )

  const autoSizeAllColumns = React.useCallback(() => {
    for (const column of dataTableRef.current?.getVisibleLeafColumns() ?? []) {
      if (column.getCanResize()) autoSizeColumn(column.id)
    }
  }, [autoSizeColumn])

  const config: DataTableConfig<TData> = {
    localization,
    icons,
    refs: {
      tablePaperRef,
      tableContainerRef,
      topToolbarRef,
      bottomToolbarRef,
      tableHeadRef,
      tableFooterRef,
      searchInputRef,
    },
    density,
    setDensity,
    isFullscreen,
    setIsFullscreen,
    showColumnFilters,
    setShowColumnFilters,
    columnFilterModes,
    setColumnFilterMode,
    globalFilterMode,
    setGlobalFilterMode,
    enableGlobalFilter,
    enableGlobalFilterModes,
    enableAdvancedFilter,
    advancedFilter,
    setAdvancedFilter,
    showAdvancedFilterPanel,
    setShowAdvancedFilterPanel,
    isLoading,
    isSaving,
    showProgressBars,
    showSkeletons,
    showLoadingOverlay,
    enableFacetedValues,
    enableColumnActions,
    enableColumnFilters,
    enableColumnFilterModes,
    enableFilterMatchHighlighting,
    columnsWithCustomCell,
    enableColumnOrdering,
    enableColumnPinning,
    enableColumnResizing,
    enableColumnAutosize,
    autoSizeColumn,
    autoSizeAllColumns,
    enableRowOrdering,
    enableRowPinning,
    enableRowNumbers,
    rowNumberMode,
    onRowOrderChange,
    enableGrouping,
    enableExpanding,
    enableStickyFooter,
    renderDetailPanel,
    enableEditing,
    editDisplayMode,
    createDisplayMode,
    editingCell,
    setEditingCell,
    editingRowId,
    isCreating,
    rowDraft,
    setRowDraftValue,
    beginRowEdit,
    beginCreate,
    cancelEdit,
    enableClickToCopy,
    onEditCellSave,
    onSaveRow,
    onCreateRow,
    renderRowActions,
    renderCellActionMenuItems,
    onRowClick,
    onRowDoubleClick,
    onCellClick,
    onCellDoubleClick,
    enableRowVirtualization,
    enableColumnVirtualization,
    estimateRowHeight,
    virtualOverscan,
    rowHeight,
    getRowHeight,
    rowVirtualizerOptions,
    columnVirtualizerOptions,
    rowVirtualizerInstanceRef,
    columnVirtualizerInstanceRef,
    enableStickyHeader,
    enablePagination,
    enableInfiniteScroll,
    onLoadMore,
    hasNextPage,
    isFetchingNextPage,
    infiniteScrollThreshold,
    positionPagination,
    paginationDisplayMode,
    columnFilterDisplayMode,
    positionGlobalFilter,
    positionToolbarAlertBanner,
    positionToolbarDropZone,
    enableRowSelection,
    enableTopToolbar,
    enableBottomToolbar,
    enableDensityToggle,
    enableFullscreenToggle,
    enableToolbarInternalActions,
    enableKeyboardNavigation,
    title,
    renderToolbarActions,
    renderTopToolbar,
    renderBottomToolbar,
    renderToolbarInternalActions,
    renderBottomToolbarCustomActions,
    renderRowActionMenuItems,
    renderColumnActionsMenuItems,
    renderColumnFilterModeMenuItems,
    renderGlobalFilterModeMenuItems,
    renderCaption,
    renderEmpty,
  }

  // v9 registers row models as feature slots instead of `get*RowModel` options.
  // Omitting a slot is how a stage is skipped (the pipeline optional-chains it),
  // which is the parity replacement for v8's `undefined` row-model option. The
  // `manual*` flags are honored by the pipeline itself, so they stay a plain
  // passthrough and do not gate a slot.
  //
  // Keyed on the gating flags rather than `[]`: v8 re-read the `get*RowModel`
  // options until a model was first used, so flipping a flag false→true
  // registered that model. Slots are resolved lazily and cached on first call in
  // v9 too, so true→false stays cached in both versions — parity holds.
  const features = React.useMemo(() => {
    const {
      paginatedRowModel,
      facetedRowModel,
      facetedUniqueValues,
      facetedMinMaxValues,
      groupedRowModel,
      expandedRowModel,
      ...base
    } = dataTableFeatures
    return {
      ...base,
      sortedRowModel: rankedSortedRowModel,
      filteredRowModel: enableAdvancedFilter
        ? advancedFilteredRowModel
        : dataTableFeatures.filteredRowModel,
      ...(enablePagination ? { paginatedRowModel } : {}),
      // Client-side faceting powers select/multi-select option lists + counts
      // and range-slider bounds. Unlike the pipeline slots, the faceting
      // feature never reads `manualFiltering`, so the gate lives here: omitted
      // in manual mode (the server supplies facets) and when
      // `enableFacetedValues` is off, in which case the faceting APIs return an
      // empty map / undefined.
      ...(enableFacetedValues && !isManualFiltering
        ? { facetedRowModel, facetedUniqueValues, facetedMinMaxValues }
        : {}),
      ...(enableGrouping ? { groupedRowModel } : {}),
      ...(enableExpanding ? { expandedRowModel } : {}),
      // The runtime object is a subset of the full feature set (slots are
      // omitted, never replaced by a different shape), so the static type stays
      // correct for every consumer of `DataTableFeatures`.
    } as DataTableFeatures
  }, [
    enablePagination,
    enableGrouping,
    enableExpanding,
    enableFacetedValues,
    isManualFiltering,
    enableAdvancedFilter,
    rankedSortedRowModel,
    advancedFilteredRowModel,
  ])

  const table: DataTableInstance<TData> = Object.assign(
    useTable({
      ...tableOptions,
      features,
      columns: sizedColumns,
      meta: { ...tableOptions.meta, dataTableRef },
      // Default page-reset off: TanStack's auto-reset runs a state update during
      // render (warns in React 19 dev). We reset on filter changes via an effect
      // below instead. Consumers can re-enable by passing the option explicitly.
      autoResetPageIndex: tableOptions.autoResetPageIndex ?? false,
      defaultColumn: {
        filterFn: dynamicFilterFn,
        ...tableOptions.defaultColumn,
      },
      enableGlobalFilter,
      globalFilterFn: tableOptions.globalFilterFn ?? dynamicGlobalFilterFn,
      enableColumnPinning,
      enableColumnResizing,
      columnResizeMode: tableOptions.columnResizeMode ?? "onChange",
      enableRowPinning,
      keepPinnedRows: tableOptions.keepPinnedRows ?? true,
      enableGrouping,
      enableExpanding,
      // Detail panels expand arbitrary rows; tree data uses getSubRows' own logic.
      getRowCanExpand:
        tableOptions.getRowCanExpand ??
        (renderDetailPanel ? () => true : undefined),
    }),
    // `config.refs` carries DOM refs by design — they are attached to elements
    // by the components that read `table.tableInstance.refs`; nothing here
    // reads `.current` during render.
    // eslint-disable-next-line react-hooks/refs
    { tableInstance: config }
  )

  // Render-phase ref write is load-bearing: cell/header renderers resolve the
  // enriched instance through `options.meta` during this same render pass.
  // eslint-disable-next-line react-hooks/refs
  dataTableRef.current = table

  usePageResetOnFilterChange(table, {
    enablePagination,
    manualPagination: tableOptions.manualPagination,
    autoResetPageIndex: tableOptions.autoResetPageIndex,
  })

  // Advanced filter edits can shrink the result set; jump back to the first
  // page so the user isn't stranded on an out-of-range page (mirrors the
  // column-filter reset above).
  const advancedFilterResetRef = React.useRef(advancedFilter)
  React.useEffect(() => {
    if (advancedFilterResetRef.current === advancedFilter) return
    advancedFilterResetRef.current = advancedFilter
    if (
      enableAdvancedFilter &&
      enablePagination &&
      !tableOptions.manualPagination
    ) {
      table.setPageIndex(0)
    }
  }, [
    advancedFilter,
    enableAdvancedFilter,
    enablePagination,
    tableOptions.manualPagination,
    table,
  ])

  return table
}

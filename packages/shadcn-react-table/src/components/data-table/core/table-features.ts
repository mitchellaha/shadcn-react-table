import {
  aggregationFns,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Every TanStack feature this table can render, plus the row-model and function
 * registry slots they depend on. v9 exposes an API only when its feature is
 * registered here, so this is the single place a missing `table.*` / `column.*`
 * method is fixed — never a cast at the call site.
 *
 * Order is load-bearing for the slot prerequisite validator: features first,
 * `columnSizingFeature` before `columnResizingFeature`, `columnFilteringFeature`
 * before global filtering and faceting, then the row-model slots.
 *
 * The full `filterFns` / `sortFns` / `aggregationFns` registries are deliberate:
 * this ships as source and consumers' column defs reference built-ins by string
 * name (`"inNumberRange"`, `"alphanumeric"`, …), so the registries must be
 * complete rather than tree-shaken. `cellSelectionFeature` and
 * `cellSpanningFeature` are unused and stay out.
 *
 * Which slots are actually *active* per table is decided in `use-data-table.ts`,
 * which spreads this object and omits or overrides slots per feature flag.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  rowPinningFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnGroupingFeature,
  rowAggregationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns,
  sortFns,
  aggregationFns,
})

/** The feature set every type in this module is parameterized by. */
export type DataTableFeatures = typeof dataTableFeatures

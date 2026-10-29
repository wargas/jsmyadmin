"use client"

import { useMemo } from "react"
import { AgGridReact, type AgGridReactProps } from "ag-grid-react"
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community"
import type { Cell, Column } from "@/lib/types"

ModuleRegistry.registerModules([AllCommunityModule])

// Follows the shadcn tokens, so light and dark mode come for free.
export const gridTheme = themeQuartz.withParams({
  backgroundColor: "var(--background)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border)",
  headerBackgroundColor: "var(--muted)",
  chromeBackgroundColor: "var(--muted)",
  accentColor: "var(--primary)",
  oddRowBackgroundColor: "color-mix(in oklch, var(--muted) 40%, transparent)",
  fontFamily: "inherit",
  fontSize: 13,
  headerFontWeight: 600,
  spacing: 6,
  wrapperBorderRadius: "var(--radius)",
})

export type GridRow = Record<string, Cell> & { __index: number }

export function rowsToGrid(rows: Cell[][]): GridRow[] {
  return rows.map((row, index) => {
    const out = { __index: index } as GridRow
    row.forEach((value, i) => (out[`c${i}`] = value))
    return out
  })
}

export function nullFormatter(value: Cell) {
  return value === null ? "NULL" : String(value)
}

export function columnsToDefs(columns: Column[]): ColDef<GridRow>[] {
  return columns.map((column, i) => ({
    field: `c${i}`,
    headerName: column.name,
    headerTooltip: column.table ? `${column.table}.${column.name}` : column.name,
    valueFormatter: (p) => nullFormatter(p.value),
    cellClassRules: { "text-muted-foreground italic": (p) => p.value === null },
  }))
}

type DataGridProps = Omit<AgGridReactProps<GridRow>, "theme"> & {
  columns?: Column[]
  rows?: Cell[][]
  className?: string
}

/** ag-grid with shadcn theming; pass `columns`/`rows` from a statement result or raw grid props. */
export function DataGrid({ columns, rows, className, columnDefs, rowData, defaultColDef, ...props }: DataGridProps) {
  const defs = useMemo(() => columnDefs ?? (columns ? columnsToDefs(columns) : []), [columnDefs, columns])
  const data = useMemo(() => rowData ?? (rows ? rowsToGrid(rows) : []), [rowData, rows])
  return (
    <div className={className ?? "h-[480px] w-full"}>
      <AgGridReact<GridRow>
        theme={gridTheme}
        columnDefs={defs}
        rowData={data}
        defaultColDef={{ sortable: true, resizable: true, filter: true, minWidth: 80, maxWidth: 480, ...defaultColDef }}
        autoSizeStrategy={{ type: "fitCellContents" }}
        enableCellTextSelection
        ensureDomOrder
        {...props}
      />
    </div>
  )
}

"use client"

import { useState, type ReactNode } from "react"
import type { SelectionChangedEvent } from "ag-grid-community"
import { RefreshCwIcon, SearchIcon } from "lucide-react"
import { useQuery } from "@/lib/api"
import type { Cell } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DataGrid, type GridRow } from "@/components/data-grid"

type QueryGridProps = {
  sql: string
  params?: Cell[]
  database?: string
  toolbar?: (selected: GridRow[]) => ReactNode
  selectable?: boolean
  className?: string
}

/** Runs a read-only query and shows it in a searchable grid. */
export function QueryGrid({ sql, params, database, toolbar, selectable, className }: QueryGridProps) {
  const { data, error, isLoading, mutate, isValidating } = useQuery(sql, params, database)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<GridRow[]>([])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" title="Atualizar" onClick={() => mutate()}>
          <RefreshCwIcon className={isValidating ? "animate-spin" : undefined} />
        </Button>
        {data && <span className="text-sm text-muted-foreground">{data.rows.length} linhas</span>}
        <div className="ml-auto flex items-center gap-2">{toolbar?.(selected)}</div>
      </div>
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <Skeleton className="h-[480px] w-full" />}
      {data && (
        <DataGrid
          columns={data.columns}
          rows={data.rows}
          quickFilterText={search}
          className={className}
          rowSelection={selectable ? { mode: "multiRow" } : undefined}
          onSelectionChanged={(e: SelectionChangedEvent<GridRow>) => setSelected(e.api.getSelectedRows())}
        />
      )}
    </div>
  )
}

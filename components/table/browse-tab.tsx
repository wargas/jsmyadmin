"use client"

import { useMemo, useState } from "react"
import type { CellValueChangedEvent, ColDef, SortChangedEvent } from "ag-grid-community"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { useQuery } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { formatDuration, formatNumber } from "@/lib/format"
import { qualified, quoteIdent } from "@/lib/sql"
import { deleteSql, isBinary, isGenerated, updateSql, type ColumnMeta } from "@/lib/table-meta"
import type { Cell } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/confirm-dialog"
import { DataGrid, nullFormatter, type GridRow } from "@/components/data-grid"
import { SqlPreview } from "@/components/sql-preview"
import { RowFormDialog } from "@/components/table/row-form-dialog"

const PAGE_SIZES = [25, 50, 100, 250, 500]

type BrowseTabProps = {
  database: string
  table: string
  columns: ColumnMeta[]
  primaryKey: string[]
  readOnly: boolean
}

type Sort = { column: string; dir: "asc" | "desc" } | null

/** Rows keyed by column name (the grid keys them by position). */
function toNamed(row: GridRow, columns: ColumnMeta[]) {
  return Object.fromEntries(columns.map((c, i) => [c.name, row[`c${i}`]])) as Record<string, Cell>
}

export function BrowseTab({ database, table, columns, primaryKey, readOnly }: BrowseTabProps) {
  const confirm = useConfirm()
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<Sort>(null)
  const [whereInput, setWhereInput] = useState("")
  const [where, setWhere] = useState("")
  const [selected, setSelected] = useState<GridRow[]>([])
  const [editing, setEditing] = useState<Record<string, Cell> | null>(null)
  const [inserting, setInserting] = useState(false)

  const from = qualified(database, table)
  const whereClause = where.trim() ? ` WHERE ${where}` : ""
  // Select columns explicitly so their order matches the metadata.
  const sql =
    `SELECT ${columns.map((c) => quoteIdent(c.name)).join(", ")} FROM ${from}${whereClause}` +
    (sort ? ` ORDER BY ${quoteIdent(sort.column)} ${sort.dir.toUpperCase()}` : "") +
    ` LIMIT ${pageSize} OFFSET ${page * pageSize}`

  const data = useQuery(sql)
  const count = useQuery(`SELECT COUNT(*) FROM ${from}${whereClause}`)
  const total = count.data ? Number(count.data.rows[0][0]) : null
  const pages = total === null ? 1 : Math.max(1, Math.ceil(total / pageSize))

  const refresh = () => Promise.all([data.mutate(), count.mutate()])

  const columnDefs = useMemo<ColDef<GridRow>[]>(
    () =>
      columns.map((c, i) => ({
        field: `c${i}`,
        headerName: c.name,
        headerTooltip: c.columnType,
        editable: !readOnly && !isBinary(c) && !isGenerated(c),
        // Sorting happens on the server; keep the order it returned.
        comparator: () => 0,
        valueFormatter: (p) => nullFormatter(p.value),
        valueParser: (p) => p.newValue,
        cellClassRules: { "text-muted-foreground italic": (p) => p.value === null },
        filter: false,
      })),
    [columns, readOnly]
  )

  async function onCellValueChanged(event: CellValueChangedEvent<GridRow>) {
    const field = event.colDef.field!
    const column = columns[Number(field.slice(1))]
    if (event.oldValue === event.newValue) return
    const original = { ...toNamed(event.data, columns), [column.name]: event.oldValue }
    const sql = updateSql(database, table, columns, primaryKey, original, { [column.name]: event.newValue })
    if (!(await execWithToast(sql, { success: "Célula atualizada" }))) {
      event.node.setDataValue(field, event.oldValue)
    }
  }

  async function onSortChanged(event: SortChangedEvent<GridRow>) {
    const state = event.api.getColumnState().find((c) => c.sort)
    const column = state ? columns[Number(state.colId.slice(1))] : null
    setSort(column && state?.sort ? { column: column.name, dir: state.sort } : null)
    setPage(0)
  }

  async function deleteSelected() {
    const sql = deleteSql(database, table, columns, primaryKey, selected.map((r) => toNamed(r, columns)))
    if (await confirm({ title: `Excluir ${selected.length} linha(s)?`, sql, destructive: true, confirmLabel: "Excluir" })) {
      if (await execWithToast(sql, { success: "Linhas excluídas" })) setSelected([])
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setWhere(whereInput)
          setPage(0)
        }}
      >
        <span className="font-mono text-sm text-muted-foreground">WHERE</span>
        <Input
          value={whereInput}
          onChange={(e) => setWhereInput(e.target.value)}
          placeholder="ex.: id > 10 AND nome LIKE '%ana%'"
          className="max-w-xl flex-1 font-mono text-xs"
        />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        <Button type="button" variant="outline" size="icon" title="Atualizar" onClick={refresh}>
          <RefreshCwIcon className={data.isValidating ? "animate-spin" : undefined} />
        </Button>
        {!readOnly && (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={selected.length !== 1}
              onClick={() => setEditing(toNamed(selected[0], columns))}
            >
              <PencilIcon />
              Editar
            </Button>
            <Button type="button" variant="destructive" disabled={!selected.length} onClick={deleteSelected}>
              <Trash2Icon />
              Excluir ({selected.length})
            </Button>
            <Button type="button" onClick={() => setInserting(true)}>
              <PlusIcon />
              Inserir
            </Button>
          </div>
        )}
      </form>

      {data.data && <SqlPreview sql={sql} className="max-h-16" />}
      {data.error && <SqlPreview sql={`${sql}\n\n-- ${(data.error as Error).message}`} className="text-destructive" />}
      {data.isLoading && <Skeleton className="h-[560px] w-full" />}
      {data.data && (
        <DataGrid
          columnDefs={columnDefs}
          rows={data.data.rows}
          className="h-[560px] w-full"
          rowSelection={readOnly ? undefined : { mode: "multiRow" }}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          onCellValueChanged={onCellValueChanged}
          onSortChanged={onSortChanged}
          onRowDoubleClicked={(e) => !readOnly && e.data && setEditing(toNamed(e.data, columns))}
          stopEditingWhenCellsLoseFocus
          singleClickEdit={false}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {total === null ? "…" : `${formatNumber(total)} linha(s)`}
          {data.data && ` · ${formatDuration(data.data.durationMs)}`}
          {!readOnly && !primaryKey.length && " · sem chave primária: as linhas são identificadas por todas as colunas"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Select value={String(pageSize)} onValueChange={(v) => (setPageSize(Number(v)), setPage(0))}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage(0)}>
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeftIcon />
          </Button>
          <span className="px-2 tabular-nums">
            {page + 1} / {pages}
          </span>
          <Button variant="outline" size="icon-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page + 1 >= pages} onClick={() => setPage(pages - 1)}>
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>

      <RowFormDialog
        database={database}
        table={table}
        columns={columns}
        primaryKey={primaryKey}
        row={inserting ? null : editing}
        open={inserting || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setInserting(false)
            setEditing(null)
          }
        }}
      />
    </div>
  )
}

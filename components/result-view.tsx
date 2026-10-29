"use client"

import { CircleCheckIcon, CircleXIcon } from "lucide-react"
import type { StatementResult } from "@/lib/types"
import { formatDuration, formatNumber } from "@/lib/format"
import { DataGrid } from "@/components/data-grid"
import { SqlPreview } from "@/components/sql-preview"

export function ResultView({ result }: { result: StatementResult }) {
  if (result.error) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <CircleXIcon className="size-4" />
          Erro{result.error.errno ? ` #${result.error.errno}` : ""}
        </div>
        <p className="text-sm">{result.error.message}</p>
        <SqlPreview sql={result.sql} />
      </div>
    )
  }

  const summary = result.columns.length
    ? `${formatNumber(result.rows.length)} linha(s) retornada(s)`
    : `${formatNumber(result.affectedRows)} linha(s) afetada(s)` +
      (Number(result.lastInsertId) ? ` · ID inserido: ${result.lastInsertId}` : "")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheckIcon className="size-4 text-emerald-600" />
        <span>{summary}</span>
        <span>·</span>
        <span>{formatDuration(result.durationMs)}</span>
      </div>
      <SqlPreview sql={result.sql} className="max-h-24" />
      {result.columns.length > 0 && (
        <DataGrid
          columns={result.columns}
          rows={result.rows}
          pagination
          paginationPageSize={100}
          className={result.rows.length > 12 ? "h-[480px] w-full" : "w-full"}
          domLayout={result.rows.length > 12 ? "normal" : "autoHeight"}
        />
      )}
    </div>
  )
}

export function ResultList({ results }: { results: StatementResult[] }) {
  return (
    <div className="flex flex-col gap-6">
      {results.map((result, i) => (
        <ResultView key={i} result={result} />
      ))}
    </div>
  )
}

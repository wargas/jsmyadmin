"use client"

import { useCallback, useMemo, useState } from "react"
import { HistoryIcon, Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { refreshAll, runSql, useRows } from "@/lib/api"
import type { StatementResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResultList } from "@/components/result-view"
import { SqlEditor } from "@/components/sql-editor"

const HISTORY_KEY = "jsmyadmin:sql-history"
const NO_DATABASE = "__none__"

function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
  } catch {
    return []
  }
}

function pushHistory(sql: string) {
  try {
    const history = [sql, ...readHistory().filter((item) => item !== sql)].slice(0, 30)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

type SqlConsoleProps = {
  /** Fixes the console to one database; otherwise a picker is shown. */
  database?: string
  initialSql?: string
}

export function SqlConsole({ database: fixedDatabase, initialSql = "" }: SqlConsoleProps) {
  const [sql, setSql] = useState(initialSql)
  const [picked, setPicked] = useState<string>(NO_DATABASE)
  const [results, setResults] = useState<StatementResult[] | null>(null)
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const database = fixedDatabase ?? (picked === NO_DATABASE ? undefined : picked)
  const { rows: databases } = useRows<{ name: string }>(
    fixedDatabase ? null : "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME"
  )
  const { rows: columns } = useRows<{ t: string; c: string }>(
    database
      ? "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION"
      : null,
    database ? [database] : undefined
  )
  const schema = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const { t, c } of columns ?? []) (out[t] ??= []).push(c)
    return out
  }, [columns])

  const run = useCallback(async () => {
    if (!sql.trim() || running) return
    setRunning(true)
    try {
      const out = await runSql(sql, { database })
      setResults(out)
      pushHistory(sql)
      if (out.some((r) => !r.columns.length)) refreshAll()
    } catch (error) {
      toast.error("Falha ao executar", { description: (error as Error).message })
    } finally {
      setRunning(false)
    }
  }, [sql, database, running])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SqlEditor
          value={sql}
          onChange={setSql}
          onRun={run}
          schema={schema}
          defaultSchema={database}
          height="240px"
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={running || !sql.trim()}>
            {running ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
            Executar
          </Button>
          <span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter</span>
          <div className="ml-auto flex items-center gap-2">
            {!fixedDatabase && (
              <Select value={picked} onValueChange={(value) => setPicked(value ?? NO_DATABASE)}>
                <SelectTrigger className="w-48">
                  <SelectValue>{(value: string) => (value === NO_DATABASE ? "Sem banco selecionado" : value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DATABASE}>Sem banco selecionado</SelectItem>
                  {databases?.map((db) => (
                    <SelectItem key={db.name} value={db.name}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DropdownMenu onOpenChange={(open) => open && setHistory(readHistory())}>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <HistoryIcon />
                Histórico
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96">
                <DropdownMenuLabel>Consultas recentes</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {history.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Vazio</div>}
                {history.map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setSql(item)} className="font-mono text-xs">
                    <span className="truncate">{item}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" title="Limpar" onClick={() => (setSql(""), setResults(null))}>
              <Trash2Icon />
            </Button>
          </div>
        </div>
      </div>
      {results && <ResultList results={results} />}
    </div>
  )
}

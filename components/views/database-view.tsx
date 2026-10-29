"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { EraserIcon, EyeIcon, TableIcon, Trash2Icon, WrenchIcon } from "lucide-react"
import { useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { formatBytes, formatNumber } from "@/lib/format"
import { tableHref } from "@/lib/routes"
import { collateClause, qualified, quoteIdent } from "@/lib/sql"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfirm } from "@/components/confirm-dialog"
import { CollationInput } from "@/components/create-database-dialog"
import { CreateTableDialog } from "@/components/create-table-dialog"
import { ExportPanel } from "@/components/export-panel"
import { ImportPanel } from "@/components/import-panel"
import { PageTitle } from "@/components/page-title"
import { QueryGrid } from "@/components/query-grid"
import { SqlConsole } from "@/components/sql-console"

type TableRowInfo = {
  name: string
  type: string
  engine: string | null
  rows: number | null
  size: number | null
  overhead: number | null
  collation: string | null
  comment: string
}

const MAINTENANCE = [
  ["OPTIMIZE", "Otimizar"],
  ["ANALYZE", "Analisar"],
  ["CHECK", "Verificar"],
  ["REPAIR", "Reparar"],
] as const

export function DatabaseView() {
  const database = decodeURIComponent(useParams<{ db: string }>().db)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageTitle title={database} description="Banco de dados" actions={<CreateTableDialog database={database} />} />
      <Tabs defaultValue="tables">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tables">Tabelas</TabsTrigger>
          <TabsTrigger value="sql">SQL</TabsTrigger>
          <TabsTrigger value="routines">Rotinas</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="export">Exportar</TabsTrigger>
          <TabsTrigger value="import">Importar</TabsTrigger>
          <TabsTrigger value="operations">Operações</TabsTrigger>
        </TabsList>
        <TabsContent value="tables">
          <TableList database={database} />
        </TabsContent>
        <TabsContent value="sql">
          <SqlConsole database={database} />
        </TabsContent>
        <TabsContent value="routines">
          <QueryGrid
            sql="SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER AS RETURNS, DEFINER, CREATED, LAST_ALTERED, ROUTINE_COMMENT FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME"
            params={[database]}
          />
        </TabsContent>
        <TabsContent value="triggers">
          <QueryGrid
            sql="SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE AS `TABLE`, ACTION_TIMING AS TIMING, EVENT_MANIPULATION AS EVENT, ACTION_STATEMENT, DEFINER FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME"
            params={[database]}
          />
        </TabsContent>
        <TabsContent value="events">
          <QueryGrid
            sql="SELECT EVENT_NAME, STATUS, EVENT_TYPE, EXECUTE_AT, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, ENDS, LAST_EXECUTED, EVENT_DEFINITION FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ? ORDER BY EVENT_NAME"
            params={[database]}
          />
        </TabsContent>
        <TabsContent value="export">
          <ExportPanel database={database} />
        </TabsContent>
        <TabsContent value="import">
          <ImportPanel database={database} />
        </TabsContent>
        <TabsContent value="operations">
          <DatabaseOperations database={database} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TableList({ database }: { database: string }) {
  const confirm = useConfirm()
  const [selected, setSelected] = useState<string[]>([])
  const { rows: tables, isLoading } = useRows<TableRowInfo>(
    `SELECT TABLE_NAME AS name, TABLE_TYPE AS type, ENGINE AS engine, TABLE_ROWS AS \`rows\`,
      DATA_LENGTH + INDEX_LENGTH AS size, DATA_FREE AS overhead, TABLE_COLLATION AS collation, TABLE_COMMENT AS comment
     FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [database]
  )
  const names = tables?.map((t) => t.name) ?? []
  const allSelected = names.length > 0 && selected.length === names.length

  async function confirmAndRun(title: string, sql: string, destructive = true) {
    if (await confirm({ title, sql, destructive, confirmLabel: "Executar" })) {
      if (await execWithToast(sql)) setSelected([])
    }
  }

  const truncate = (list: string[]) =>
    confirmAndRun(
      `Esvaziar ${list.length === 1 ? list[0] : `${list.length} tabelas`}?`,
      list.map((t) => `TRUNCATE TABLE ${qualified(database, t)};`).join("\n")
    )

  const drop = (list: string[]) => {
    const views = new Set(tables?.filter((t) => t.type === "VIEW").map((t) => t.name))
    const sql = [
      list.filter((t) => !views.has(t)).length &&
        `DROP TABLE ${list.filter((t) => !views.has(t)).map((t) => qualified(database, t)).join(", ")};`,
      list.filter((t) => views.has(t)).length &&
        `DROP VIEW ${list.filter((t) => views.has(t)).map((t) => qualified(database, t)).join(", ")};`,
    ]
      .filter(Boolean)
      .join("\n")
    return confirmAndRun(`Excluir ${list.length === 1 ? list[0] : `${list.length} tabelas`}?`, sql)
  }

  const totals = tables?.reduce(
    (acc, t) => ({ rows: acc.rows + Number(t.rows ?? 0), size: acc.size + Number(t.size ?? 0) }),
    { rows: 0, size: 0 }
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selected.length ? `${selected.length} selecionada(s)` : `${names.length} tabela(s)`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!selected.length} onClick={() => truncate(selected)}>
            <EraserIcon />
            Esvaziar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={!selected.length} />}>
              <WrenchIcon />
              Manutenção
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MAINTENANCE.map(([command, label]) => (
                <DropdownMenuItem
                  key={command}
                  onClick={() =>
                    execWithToast(`${command} TABLE ${selected.map((t) => qualified(database, t)).join(", ")}`, {
                      success: `${label}: concluído`,
                    })
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="destructive" size="sm" disabled={!selected.length} onClick={() => drop(selected)}>
            <Trash2Icon />
            Excluir
          </Button>
        </div>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? names : [])} />
              </TableHead>
              <TableHead>Tabela</TableHead>
              <TableHead>Engine</TableHead>
              <TableHead className="text-right">Linhas</TableHead>
              <TableHead className="text-right">Tamanho</TableHead>
              <TableHead className="text-right">Overhead</TableHead>
              <TableHead>Collation</TableHead>
              <TableHead>Comentário</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {tables?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Nenhuma tabela neste banco.
                </TableCell>
              </TableRow>
            )}
            {tables?.map((t) => (
              <TableRow key={t.name} data-state={selected.includes(t.name) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(t.name)}
                    onCheckedChange={(v) => setSelected(v ? [...selected, t.name] : selected.filter((n) => n !== t.name))}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={tableHref(database, t.name)} className="inline-flex items-center gap-2 hover:underline">
                    {t.type === "VIEW" ? <EyeIcon className="size-4" /> : <TableIcon className="size-4" />}
                    {t.name}
                  </Link>
                  {t.type === "VIEW" && (
                    <Badge variant="secondary" className="ml-2">
                      view
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{t.engine ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{t.type === "VIEW" ? "—" : `~${formatNumber(t.rows)}`}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBytes(t.size)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(t.overhead) ? formatBytes(t.overhead) : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.collation ?? "—"}</TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">{t.comment}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {t.type !== "VIEW" && (
                      <Button variant="ghost" size="icon-sm" title="Esvaziar" onClick={() => truncate([t.name])}>
                        <EraserIcon />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" title="Excluir" onClick={() => drop([t.name])}>
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {totals && names.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell />
                <TableCell colSpan={2}>{names.length} tabela(s)</TableCell>
                <TableCell className="text-right tabular-nums">~{formatNumber(totals.rows)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBytes(totals.size)}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

function DatabaseOperations({ database }: { database: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [collation, setCollation] = useState("")

  return (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-medium">Collation padrão</h2>
        <div className="flex flex-col gap-2">
          <Label>Nova collation</Label>
          <CollationInput value={collation} onChange={(e) => setCollation(e.target.value)} />
        </div>
        <Button
          className="self-start"
          disabled={!collateClause(collation)}
          onClick={() =>
            execWithToast(`ALTER DATABASE ${quoteIdent(database)}${collateClause(collation)}`, {
              success: "Collation alterada",
            })
          }
        >
          Alterar
        </Button>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-4">
        <h2 className="font-medium text-destructive">Excluir banco de dados</h2>
        <p className="text-sm text-muted-foreground">Remove o banco {database} e todas as suas tabelas.</p>
        <Button
          variant="destructive"
          className="self-start"
          onClick={async () => {
            const sql = `DROP DATABASE ${quoteIdent(database)}`
            if (!(await confirm({ title: `Excluir ${database}?`, sql, destructive: true, confirmLabel: "Excluir" }))) return
            if (await execWithToast(sql, { success: `Banco ${database} excluído` })) router.push("/")
          }}
        >
          <Trash2Icon />
          Excluir banco
        </Button>
      </div>
    </div>
  )
}

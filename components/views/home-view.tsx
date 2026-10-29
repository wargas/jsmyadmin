"use client"

import Link from "next/link"
import { Trash2Icon } from "lucide-react"
import { useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { formatBytes, formatNumber } from "@/lib/format"
import { databaseHref } from "@/lib/routes"
import { quoteIdent } from "@/lib/sql"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useConfirm } from "@/components/confirm-dialog"
import { CreateDatabaseDialog } from "@/components/create-database-dialog"
import { PageTitle } from "@/components/page-title"

const SYSTEM_DATABASES = new Set(["information_schema", "mysql", "performance_schema", "sys"])

type ServerInfo = {
  version: string
  comment: string
  user: string
  hostname: string
  port: number
  charset: string
  collation: string
  uptime: string
}

type DatabaseRow = { name: string; collation: string; tables: number; size: number | null }

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}min`].filter(Boolean).join(" ")
}

export function HomeView() {
  const confirm = useConfirm()
  const { rows: info } = useRows<ServerInfo>(
    `SELECT VERSION() AS version, @@version_comment AS comment, CURRENT_USER() AS user, @@hostname AS hostname,
      @@port AS port, @@character_set_server AS charset, @@collation_server AS collation,
      (SELECT VARIABLE_VALUE FROM performance_schema.global_status WHERE VARIABLE_NAME = 'Uptime') AS uptime`
  )
  const { rows: databases, isLoading } = useRows<DatabaseRow>(
    `SELECT s.SCHEMA_NAME AS name, s.DEFAULT_COLLATION_NAME AS collation, COUNT(t.TABLE_NAME) AS tables,
      SUM(t.DATA_LENGTH + t.INDEX_LENGTH) AS size
     FROM information_schema.SCHEMATA s
     LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = s.SCHEMA_NAME
     GROUP BY s.SCHEMA_NAME, s.DEFAULT_COLLATION_NAME ORDER BY s.SCHEMA_NAME`
  )
  const server = info?.[0]

  async function drop(name: string) {
    const sql = `DROP DATABASE ${quoteIdent(name)}`
    const ok = await confirm({
      title: `Excluir o banco ${name}?`,
      description: "Todas as tabelas e dados serão apagados permanentemente.",
      sql,
      confirmLabel: "Excluir",
      destructive: true,
    })
    if (ok) await execWithToast(sql, { success: `Banco ${name} excluído` })
  }

  const facts = server && [
    ["Servidor", `${server.hostname}:${server.port}`],
    ["Versão", `${server.version} (${server.comment})`],
    ["Usuário", server.user],
    ["Charset", `${server.charset} / ${server.collation}`],
    ["Uptime", server.uptime ? formatUptime(Number(server.uptime)) : "—"],
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Visão geral" description="Informações do servidor e bancos de dados" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(facts ?? Array.from({ length: 5 }, () => null)).map((fact, i) => (
          <Card key={i} size="sm">
            <CardHeader>
              <CardDescription>{fact?.[0] ?? <Skeleton className="h-4 w-16" />}</CardDescription>
              <CardTitle className="truncate text-sm" title={fact?.[1]}>
                {fact?.[1] ?? <Skeleton className="h-5 w-28" />}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bancos de dados</CardTitle>
            <CardDescription>{databases ? `${databases.length} bancos` : "Carregando…"}</CardDescription>
          </div>
          <CreateDatabaseDialog />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Collation</TableHead>
                <TableHead className="text-right">Tabelas</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {databases?.map((db) => (
                <TableRow key={db.name}>
                  <TableCell className="font-medium">
                    <Link href={databaseHref(db.name)} className="hover:underline">
                      {db.name}
                    </Link>
                    {SYSTEM_DATABASES.has(db.name) && (
                      <Badge variant="secondary" className="ml-2">
                        sistema
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{db.collation}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(db.tables)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBytes(db.size)}</TableCell>
                  <TableCell>
                    {!SYSTEM_DATABASES.has(db.name) && (
                      <Button variant="ghost" size="icon-sm" title="Excluir" onClick={() => drop(db.name)}>
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

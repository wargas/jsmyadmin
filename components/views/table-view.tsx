"use client"

import { useParams } from "next/navigation"
import { useTableMeta } from "@/lib/table-meta"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExportPanel } from "@/components/export-panel"
import { PageTitle } from "@/components/page-title"
import { SqlConsole } from "@/components/sql-console"
import { qualified } from "@/lib/sql"
import { BrowseTab } from "@/components/table/browse-tab"
import { OperationsTab } from "@/components/table/operations-tab"
import { StructureTab } from "@/components/table/structure-tab"

export function TableView() {
  const params = useParams<{ db: string; table: string }>()
  const database = decodeURIComponent(params.db)
  const table = decodeURIComponent(params.table)
  const { columns, primaryKey, isView, exists, isLoading } = useTableMeta(database, table)

  if (exists === false) {
    return <p className="text-muted-foreground">A tabela {database}.{table} não existe.</p>
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageTitle
        title={
          <span className="flex items-center gap-2">
            {table}
            {isView && <Badge variant="secondary">view</Badge>}
          </span>
        }
        description={database}
      />
      {isLoading || !columns ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Navegar</TabsTrigger>
            <TabsTrigger value="structure">Estrutura</TabsTrigger>
            <TabsTrigger value="sql">SQL</TabsTrigger>
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="operations">Operações</TabsTrigger>
          </TabsList>
          <TabsContent value="browse">
            <BrowseTab database={database} table={table} columns={columns} primaryKey={primaryKey} readOnly={isView} />
          </TabsContent>
          <TabsContent value="structure">
            <StructureTab database={database} table={table} columns={columns} isView={isView} />
          </TabsContent>
          <TabsContent value="sql">
            <SqlConsole database={database} initialSql={`SELECT * FROM ${qualified(database, table)} WHERE 1 LIMIT 100`} />
          </TabsContent>
          <TabsContent value="export">
            <ExportPanel database={database} table={table} />
          </TabsContent>
          <TabsContent value="operations">
            <OperationsTab database={database} table={table} isView={isView} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

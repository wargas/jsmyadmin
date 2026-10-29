"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { execWithToast } from "@/lib/actions"
import { tableHref } from "@/lib/routes"
import { collateClause, qualified, quoteIdent, quoteString } from "@/lib/sql"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColumnEditor, columnSql, emptyColumn, type ColumnSpec } from "@/components/column-editor"
import { CollationInput } from "@/components/create-database-dialog"
import { SqlPreview } from "@/components/sql-preview"

export function createTableSql(
  database: string,
  name: string,
  columns: ColumnSpec[],
  options: { engine: string; collation: string; comment: string }
) {
  const lines = columns.map((c) => "  " + columnSql(c))
  const primary = columns.filter((c) => c.primary).map((c) => quoteIdent(c.name))
  if (primary.length) lines.push(`  PRIMARY KEY (${primary.join(", ")})`)
  let sql = `CREATE TABLE ${qualified(database, name || "tabela")} (\n${lines.join(",\n")}\n)`
  if (options.engine) sql += ` ENGINE=${options.engine.replace(/\W/g, "")}`
  sql += collateClause(options.collation)
  if (options.comment) sql += ` COMMENT=${quoteString(options.comment)}`
  return sql
}

export function CreateTableDialog({ database }: { database: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [engine, setEngine] = useState("InnoDB")
  const [collation, setCollation] = useState("")
  const [comment, setComment] = useState("")
  const [columns, setColumns] = useState<ColumnSpec[]>([
    emptyColumn({ name: "id", type: "INT", unsigned: true, autoIncrement: true, primary: true }),
  ])
  const sql = createTableSql(database, name, columns, { engine, collation, comment })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Nova tabela
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await execWithToast(sql, { success: `Tabela ${name} criada` })) {
              setOpen(false)
              router.push(tableHref(database, name))
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Criar tabela em {database}</DialogTitle>
            <DialogDescription>Defina as colunas; o SQL gerado aparece abaixo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Engine</Label>
              <Input value={engine} onChange={(e) => setEngine(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Collation</Label>
              <CollationInput value={collation} onChange={(e) => setCollation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Comentário</Label>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
          <ColumnEditor columns={columns} onChange={setColumns} />
          <Button type="button" variant="outline" className="self-start" onClick={() => setColumns([...columns, emptyColumn()])}>
            <PlusIcon />
            Adicionar coluna
          </Button>
          <SqlPreview sql={sql} />
          <DialogFooter>
            <Button type="submit" disabled={!name || columns.some((c) => !c.name)}>
              Criar tabela
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

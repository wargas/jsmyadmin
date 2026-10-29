"use client"

import { useState } from "react"
import { KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useQuery, useRows } from "@/lib/api"
import { execWithToast } from "@/lib/actions"
import { qualified, quoteIdent } from "@/lib/sql"
import { isAutoIncrement, type ColumnMeta } from "@/lib/table-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useConfirm } from "@/components/confirm-dialog"
import { ColumnEditor, columnSql, emptyColumn, type ColumnSpec } from "@/components/column-editor"
import { SqlPreview } from "@/components/sql-preview"

type Props = { database: string; table: string; columns: ColumnMeta[]; isView: boolean }

type IndexRow = { Key_name: string; Non_unique: number; Column_name: string; Seq_in_index: number; Index_type: string; Cardinality: number | null }

type ForeignKey = {
  name: string
  column: string
  refSchema: string
  refTable: string
  refColumn: string
  onUpdate: string
  onDelete: string
}

const FK_RULES = ["RESTRICT", "CASCADE", "SET NULL", "NO ACTION"]

function toSpec(c: ColumnMeta): ColumnSpec {
  const match = /^(\w+)(?:\((.*)\))?/.exec(c.columnType)
  return {
    name: c.name,
    type: (match?.[1] ?? c.dataType).toUpperCase(),
    length: match?.[2] ?? "",
    unsigned: /unsigned/i.test(c.columnType),
    nullable: c.nullable,
    default: c.default === null ? (c.nullable ? "NULL" : "") : String(c.default),
    autoIncrement: isAutoIncrement(c),
    primary: c.key === "PRI",
    comment: c.comment,
  }
}

export function StructureTab({ database, table, columns, isView }: Props) {
  const confirm = useConfirm()
  const target = qualified(database, table)

  async function alter(title: string, sql: string, destructive = false) {
    if (await confirm({ title, sql, destructive, confirmLabel: "Executar" })) await execWithToast(sql)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Colunas</h2>
          {!isView && <AddColumnsDialog database={database} table={table} columns={columns} />}
        </div>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Collation</TableHead>
                <TableHead>Nulo</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Extra</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((c, i) => (
                <TableRow key={c.name}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {c.key === "PRI" && <KeyRoundIcon className="size-3.5 text-amber-500" />}
                      {c.name}
                    </span>
                    {c.key === "UNI" && <Badge variant="outline" className="ml-2">único</Badge>}
                    {c.key === "MUL" && <Badge variant="outline" className="ml-2">índice</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.columnType}</TableCell>
                  <TableCell className="text-muted-foreground">{c.collation ?? ""}</TableCell>
                  <TableCell>{c.nullable ? "Sim" : "Não"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.default === null ? (c.nullable ? <i className="text-muted-foreground">NULL</i> : "—") : String(c.default)}
                  </TableCell>
                  <TableCell className="text-xs uppercase">{c.extra}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{c.comment}</TableCell>
                  <TableCell>
                    {!isView && (
                      <div className="flex justify-end">
                        <EditColumnDialog database={database} table={table} column={c} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Excluir coluna"
                          disabled={columns.length === 1}
                          onClick={() => alter(`Excluir a coluna ${c.name}?`, `ALTER TABLE ${target} DROP COLUMN ${quoteIdent(c.name)}`, true)}
                        >
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {!isView && <Indexes database={database} table={table} columns={columns} alter={alter} />}
      {!isView && <ForeignKeys database={database} table={table} columns={columns} alter={alter} />}
      <CreateStatement database={database} table={table} isView={isView} />
    </div>
  )
}

function AddColumnsDialog({ database, table, columns }: { database: string; table: string; columns: ColumnMeta[] }) {
  const [open, setOpen] = useState(false)
  const [specs, setSpecs] = useState<ColumnSpec[]>([emptyColumn()])
  const [after, setAfter] = useState(columns[columns.length - 1]?.name ?? "")
  const position = after === "__first__" ? " FIRST" : after ? ` AFTER ${quoteIdent(after)}` : ""
  // Chain AFTER so the new columns keep their order.
  const clauses = specs.map((spec, i) => {
    const anchor = i === 0 ? position : ` AFTER ${quoteIdent(specs[i - 1].name || "coluna")}`
    const pk = spec.primary ? `, ADD PRIMARY KEY (${quoteIdent(spec.name)})` : ""
    return `ADD COLUMN ${columnSql(spec)}${anchor}${pk}`
  })
  const sql = `ALTER TABLE ${qualified(database, table)}\n  ${clauses.join(",\n  ")}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon />
        Adicionar colunas
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Adicionar colunas em {table}</DialogTitle>
        </DialogHeader>
        <ColumnEditor columns={specs} onChange={setSpecs} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSpecs([...specs, emptyColumn()])}>
            <PlusIcon />
            Mais uma
          </Button>
          <Label className="ml-auto">Posição</Label>
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={after} onChange={(e) => setAfter(e.target.value)}>
            <option value="__first__">No início</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                Depois de {c.name}
              </option>
            ))}
          </select>
        </div>
        <SqlPreview sql={sql} />
        <DialogFooter>
          <Button
            disabled={specs.some((s) => !s.name)}
            onClick={async () => {
              if (await execWithToast(sql, { success: "Colunas adicionadas" })) {
                setOpen(false)
                setSpecs([emptyColumn()])
              }
            }}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditColumnDialog({ database, table, column }: { database: string; table: string; column: ColumnMeta }) {
  const [open, setOpen] = useState(false)
  const [spec, setSpec] = useState(() => toSpec(column))
  // The primary key is managed through indexes, not CHANGE COLUMN.
  const sql = `ALTER TABLE ${qualified(database, table)} CHANGE COLUMN ${quoteIdent(column.name)} ${columnSql(spec)}`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSpec(toSpec(column))
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Editar coluna" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editar coluna {column.name}</DialogTitle>
        </DialogHeader>
        <ColumnEditor columns={[spec]} onChange={([next]) => setSpec(next)} removable={false} />
        <p className="text-xs text-muted-foreground">A chave primária é alterada na seção de índices.</p>
        <SqlPreview sql={sql} />
        <DialogFooter>
          <Button
            disabled={!spec.name}
            onClick={async () => {
              if (await execWithToast(sql, { success: "Coluna alterada" })) setOpen(false)
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type AlterFn = (title: string, sql: string, destructive?: boolean) => Promise<void>

function Indexes({ database, table, columns, alter }: { database: string; table: string; columns: ColumnMeta[]; alter: AlterFn }) {
  const target = qualified(database, table)
  const { rows } = useRows<IndexRow>(`SHOW INDEX FROM ${target}`)
  const indexes = Object.values(
    (rows ?? []).reduce<Record<string, { name: string; unique: boolean; type: string; columns: string[]; cardinality: number | null }>>(
      (acc, r) => {
        acc[r.Key_name] ??= { name: r.Key_name, unique: !Number(r.Non_unique), type: r.Index_type, columns: [], cardinality: r.Cardinality }
        acc[r.Key_name].columns[Number(r.Seq_in_index) - 1] = r.Column_name ?? "(expressão)"
        return acc
      },
      {}
    )
  )

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Índices</h2>
        <AddIndexDialog target={target} columns={columns} />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Único</TableHead>
              <TableHead>Colunas</TableHead>
              <TableHead className="text-right">Cardinalidade</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {indexes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum índice definido.
                </TableCell>
              </TableRow>
            )}
            {indexes.map((index) => (
              <TableRow key={index.name}>
                <TableCell className="font-medium">{index.name}</TableCell>
                <TableCell>{index.type}</TableCell>
                <TableCell>{index.unique ? "Sim" : "Não"}</TableCell>
                <TableCell className="font-mono text-xs">{index.columns.join(", ")}</TableCell>
                <TableCell className="text-right tabular-nums">{index.cardinality ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Excluir índice"
                    onClick={() =>
                      alter(
                        `Excluir o índice ${index.name}?`,
                        index.name === "PRIMARY"
                          ? `ALTER TABLE ${target} DROP PRIMARY KEY`
                          : `ALTER TABLE ${target} DROP INDEX ${quoteIdent(index.name)}`,
                        true
                      )
                    }
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function AddIndexDialog({ target, columns }: { target: string; columns: ColumnMeta[] }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState("INDEX")
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const list = picked.map(quoteIdent).join(", ")
  const sql =
    kind === "PRIMARY"
      ? `ALTER TABLE ${target} ADD PRIMARY KEY (${list})`
      : `ALTER TABLE ${target} ADD ${kind === "INDEX" ? "INDEX" : `${kind} INDEX`}${name ? ` ${quoteIdent(name)}` : ""} (${list})`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon />
        Novo índice
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar índice</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="INDEX">INDEX</option>
              <option value="UNIQUE">UNIQUE</option>
              <option value="FULLTEXT">FULLTEXT</option>
              <option value="SPATIAL">SPATIAL</option>
              <option value="PRIMARY">PRIMARY KEY</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nome</Label>
            <Input value={name} disabled={kind === "PRIMARY"} onChange={(e) => setName(e.target.value)} placeholder="automático" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Colunas (na ordem em que forem marcadas)</Label>
          {columns.map((c) => (
            <label key={c.name} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={picked.includes(c.name)}
                onCheckedChange={(v) => setPicked(v ? [...picked, c.name] : picked.filter((p) => p !== c.name))}
              />
              {c.name} <span className="font-mono text-xs text-muted-foreground">{c.columnType}</span>
            </label>
          ))}
        </div>
        <SqlPreview sql={sql} />
        <DialogFooter>
          <Button
            disabled={!picked.length}
            onClick={async () => {
              if (await execWithToast(sql, { success: "Índice criado" })) {
                setOpen(false)
                setPicked([])
                setName("")
              }
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ForeignKeys({ database, table, columns, alter }: { database: string; table: string; columns: ColumnMeta[]; alter: AlterFn }) {
  const target = qualified(database, table)
  const { rows } = useRows<ForeignKey>(
    `SELECT k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS \`column\`, k.REFERENCED_TABLE_SCHEMA AS refSchema,
      k.REFERENCED_TABLE_NAME AS refTable, k.REFERENCED_COLUMN_NAME AS refColumn, r.UPDATE_RULE AS onUpdate, r.DELETE_RULE AS onDelete
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    [database, table]
  )

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Chaves estrangeiras</h2>
        <AddForeignKeyDialog database={database} target={target} columns={columns} />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Coluna</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>ON UPDATE</TableHead>
              <TableHead>ON DELETE</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma chave estrangeira.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((fk) => (
              <TableRow key={fk.name + fk.column}>
                <TableCell className="font-medium">{fk.name}</TableCell>
                <TableCell className="font-mono text-xs">{fk.column}</TableCell>
                <TableCell className="font-mono text-xs">
                  {fk.refSchema}.{fk.refTable}.{fk.refColumn}
                </TableCell>
                <TableCell>{fk.onUpdate}</TableCell>
                <TableCell>{fk.onDelete}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Excluir chave"
                    onClick={() => alter(`Excluir a chave ${fk.name}?`, `ALTER TABLE ${target} DROP FOREIGN KEY ${quoteIdent(fk.name)}`, true)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function AddForeignKeyDialog({ database, target, columns }: { database: string; target: string; columns: ColumnMeta[] }) {
  const [open, setOpen] = useState(false)
  const [column, setColumn] = useState(columns[0]?.name ?? "")
  const [refTable, setRefTable] = useState("")
  const [refColumn, setRefColumn] = useState("")
  const [onDelete, setOnDelete] = useState("RESTRICT")
  const [onUpdate, setOnUpdate] = useState("RESTRICT")
  const { rows: tables } = useRows<{ name: string }>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY 1",
    [database]
  )
  const { rows: refColumns } = useRows<{ name: string }>(
    refTable ? "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION" : null,
    [database, refTable]
  )
  const sql =
    `ALTER TABLE ${target} ADD FOREIGN KEY (${quoteIdent(column)})\n` +
    `  REFERENCES ${qualified(database, refTable || "tabela")} (${quoteIdent(refColumn || "coluna")})\n` +
    `  ON DELETE ${onDelete} ON UPDATE ${onUpdate}`

  const select = (value: string, onChange: (v: string) => void, options: string[]) => (
    <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        —
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon />
        Nova chave
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar chave estrangeira</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-2">
            <Label>Coluna</Label>
            {select(column, setColumn, columns.map((c) => c.name))}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tabela referenciada</Label>
            {select(refTable, (v) => (setRefTable(v), setRefColumn("")), tables?.map((t) => t.name) ?? [])}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Coluna referenciada</Label>
            {select(refColumn, setRefColumn, refColumns?.map((c) => c.name) ?? [])}
          </div>
          <div className="flex flex-col gap-2">
            <Label>ON DELETE</Label>
            {select(onDelete, setOnDelete, FK_RULES)}
          </div>
          <div className="flex flex-col gap-2">
            <Label>ON UPDATE</Label>
            {select(onUpdate, setOnUpdate, FK_RULES)}
          </div>
        </div>
        <SqlPreview sql={sql} />
        <DialogFooter>
          <Button
            disabled={!column || !refTable || !refColumn}
            onClick={async () => {
              if (await execWithToast(sql, { success: "Chave estrangeira criada" })) setOpen(false)
            }}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateStatement({ database, table, isView }: { database: string; table: string; isView: boolean }) {
  const { data } = useQuery(`SHOW CREATE ${isView ? "VIEW" : "TABLE"} ${qualified(database, table)}`)
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Definição</h2>
      {data && <SqlPreview sql={String(data.rows[0]?.[1] ?? "")} className="max-h-96" />}
    </section>
  )
}

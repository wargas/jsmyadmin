"use client"

import { Trash2Icon } from "lucide-react"
import { quoteIdent, quoteString } from "@/lib/sql"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export const COLUMN_TYPES = [
  "INT", "TINYINT", "SMALLINT", "MEDIUMINT", "BIGINT", "DECIMAL", "FLOAT", "DOUBLE", "BIT", "BOOLEAN",
  "VARCHAR", "CHAR", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "JSON", "ENUM", "SET",
  "DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR",
  "BINARY", "VARBINARY", "BLOB", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB",
  "GEOMETRY", "POINT",
]

export type ColumnSpec = {
  name: string
  type: string
  length: string
  unsigned: boolean
  nullable: boolean
  default: string
  autoIncrement: boolean
  primary: boolean
  comment: string
}

export const emptyColumn = (overrides: Partial<ColumnSpec> = {}): ColumnSpec => ({
  name: "",
  type: "VARCHAR",
  length: "",
  unsigned: false,
  nullable: false,
  default: "",
  autoIncrement: false,
  primary: false,
  comment: "",
  ...overrides,
})

const DEFAULT_KEYWORDS = /^(NULL|CURRENT_TIMESTAMP(\(\d*\))?|NOW\(\)|\(.*\))$/i

/** Column definition without the PRIMARY KEY (that goes in a table-level clause). */
export function columnSql(column: ColumnSpec) {
  const type = column.type.toUpperCase()
  const needsLength = ["VARCHAR", "VARBINARY"].includes(type)
  const length = column.length || (needsLength ? "255" : "")
  let sql = `${quoteIdent(column.name || "coluna")} ${type}${length ? `(${length})` : ""}`
  if (column.unsigned) sql += " UNSIGNED"
  sql += column.nullable ? " NULL" : " NOT NULL"
  if (column.default !== "") {
    sql += ` DEFAULT ${DEFAULT_KEYWORDS.test(column.default) ? column.default : quoteString(column.default)}`
  }
  if (column.autoIncrement) sql += " AUTO_INCREMENT"
  if (column.comment) sql += ` COMMENT ${quoteString(column.comment)}`
  return sql
}

export function ColumnEditor({
  columns,
  onChange,
  removable = true,
}: {
  columns: ColumnSpec[]
  onChange: (columns: ColumnSpec[]) => void
  removable?: boolean
}) {
  const update = (index: number, patch: Partial<ColumnSpec>) =>
    onChange(columns.map((column, i) => (i === index ? { ...column, ...patch } : column)))

  return (
    <div className="overflow-x-auto">
      <datalist id="column-types">
        {COLUMN_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:font-medium">
            <th>Nome</th>
            <th>Tipo</th>
            <th>Tamanho / valores</th>
            <th>Padrão</th>
            <th title="Unsigned">UN</th>
            <th title="Permite NULL">NULL</th>
            <th title="Auto increment">AI</th>
            <th title="Chave primária">PK</th>
            <th>Comentário</th>
            {removable && <th />}
          </tr>
        </thead>
        <tbody>
          {columns.map((column, i) => (
            <tr key={i} className="[&>td]:px-1 [&>td]:py-0.5">
              <td>
                <Input value={column.name} onChange={(e) => update(i, { name: e.target.value })} className="min-w-32" />
              </td>
              <td>
                <Input
                  list="column-types"
                  value={column.type}
                  onChange={(e) => update(i, { type: e.target.value })}
                  className="min-w-28"
                />
              </td>
              <td>
                <Input
                  value={column.length}
                  placeholder={column.type.toUpperCase().startsWith("ENUM") ? "'a','b'" : ""}
                  onChange={(e) => update(i, { length: e.target.value })}
                  className="min-w-24"
                />
              </td>
              <td>
                <Input
                  value={column.default}
                  placeholder="nenhum"
                  onChange={(e) => update(i, { default: e.target.value })}
                  className="min-w-28"
                />
              </td>
              <td>
                <Checkbox checked={column.unsigned} onCheckedChange={(v) => update(i, { unsigned: v })} />
              </td>
              <td>
                <Checkbox checked={column.nullable} onCheckedChange={(v) => update(i, { nullable: v })} />
              </td>
              <td>
                <Checkbox checked={column.autoIncrement} onCheckedChange={(v) => update(i, { autoIncrement: v })} />
              </td>
              <td>
                <Checkbox checked={column.primary} onCheckedChange={(v) => update(i, { primary: v })} />
              </td>
              <td>
                <Input value={column.comment} onChange={(e) => update(i, { comment: e.target.value })} className="min-w-32" />
              </td>
              {removable && (
                <td>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={columns.length === 1}
                    onClick={() => onChange(columns.filter((_, j) => j !== i))}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

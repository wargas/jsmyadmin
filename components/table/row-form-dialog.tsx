"use client"

import { useState } from "react"
import { execWithToast } from "@/lib/actions"
import { literal, qualified, quoteIdent } from "@/lib/sql"
import {
  enumValues,
  isAutoIncrement,
  isBinary,
  isGenerated,
  isLongText,
  updateSql,
  type ColumnMeta,
} from "@/lib/table-meta"
import type { Cell } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SqlPreview } from "@/components/sql-preview"

type Field = { value: string; isNull: boolean }

type RowFormDialogProps = {
  database: string
  table: string
  columns: ColumnMeta[]
  primaryKey: string[]
  /** Row being edited; omit to insert. */
  row?: Record<string, Cell> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

function initialFields(columns: ColumnMeta[], row?: Record<string, Cell> | null) {
  return Object.fromEntries(
    columns.map((c) => {
      const value = row ? row[c.name] : null
      return [c.name, { value: value === null ? "" : String(value), isNull: row ? value === null : false }]
    })
  ) as Record<string, Field>
}

/** Insert leaves a blank field out so the server applies its default / auto increment. */
function omittedOnInsert(column: ColumnMeta, field: Field) {
  return isGenerated(column) || (!field.isNull && field.value === "" && (isAutoIncrement(column) || column.default !== null || column.nullable))
}

export function RowFormDialog(props: RowFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Remount per row so the fields reset. */}
        {props.open && <RowForm key={JSON.stringify(props.row ?? null)} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function RowForm({ database, table, columns, primaryKey, row, onOpenChange, onSaved }: RowFormDialogProps) {
  const [fields, setFields] = useState(() => initialFields(columns, row))
  const editing = !!row
  const original = initialFields(columns, row)

  const value = (c: ColumnMeta): Cell => (fields[c.name].isNull ? null : fields[c.name].value)

  let sql: string
  if (editing) {
    const changes = Object.fromEntries(
      columns
        .filter((c) => !isGenerated(c))
        .filter((c) => fields[c.name].isNull !== original[c.name].isNull || fields[c.name].value !== original[c.name].value)
        .map((c) => [c.name, value(c)])
    )
    sql = Object.keys(changes).length ? updateSql(database, table, columns, primaryKey, row!, changes) : ""
  } else {
    const included = columns.filter((c) => !omittedOnInsert(c, fields[c.name]))
    sql =
      `INSERT INTO ${qualified(database, table)} (${included.map((c) => quoteIdent(c.name)).join(", ")})\n` +
      `VALUES (${included.map((c) => literal(value(c), isBinary(c))).join(", ")})`
  }

  const set = (name: string, patch: Partial<Field>) => setFields((f) => ({ ...f, [name]: { ...f[name], ...patch } }))

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!sql) return onOpenChange(false)
        if (await execWithToast(sql, { success: editing ? "Linha atualizada" : "Linha inserida" })) {
          onOpenChange(false)
          onSaved?.()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{editing ? "Editar linha" : "Inserir linha"}</DialogTitle>
        <DialogDescription>
          {table} · campos binários aceitam hexadecimal (0x…)
          {!editing && " · campos vazios com padrão são omitidos"}
        </DialogDescription>
      </DialogHeader>
      <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
        {columns.map((c) => {
          const field = fields[c.name]
          const options = enumValues(c)
          const disabled = field.isNull || isGenerated(c)
          return (
            <div key={c.name} className="grid grid-cols-[10rem_1fr_auto] items-start gap-3">
              <div className="pt-1.5">
                <div className="truncate text-sm font-medium" title={c.name}>
                  {c.name}
                  {primaryKey.includes(c.name) && <span className="ml-1 text-xs text-amber-600">PK</span>}
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground" title={c.columnType}>
                  {c.columnType}
                </div>
              </div>
              {options && !c.dataType.startsWith("set") ? (
                <select
                  className="h-8 rounded-lg border bg-transparent px-2 text-sm disabled:opacity-50"
                  value={field.value}
                  disabled={disabled}
                  onChange={(e) => set(c.name, { value: e.target.value })}
                >
                  <option value="" />
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : isLongText(c) ? (
                <Textarea
                  value={field.value}
                  disabled={disabled}
                  onChange={(e) => set(c.name, { value: e.target.value })}
                  className="min-h-16 font-mono text-xs"
                />
              ) : (
                <Input
                  value={field.value}
                  disabled={disabled}
                  placeholder={
                    isGenerated(c) ? "gerado" : isAutoIncrement(c) ? "auto" : c.default !== null ? `padrão: ${c.default}` : ""
                  }
                  onChange={(e) => set(c.name, { value: e.target.value })}
                />
              )}
              <label className="flex items-center gap-1.5 pt-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={field.isNull}
                  disabled={!c.nullable || isGenerated(c)}
                  onCheckedChange={(v) => set(c.name, { isNull: v })}
                />
                NULL
              </label>
            </div>
          )
        })}
      </div>
      <SqlPreview sql={sql || "-- nenhuma alteração"} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit">{editing ? "Salvar" : "Inserir"}</Button>
      </DialogFooter>
    </form>
  )
}

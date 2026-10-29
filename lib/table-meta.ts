"use client"

import { useRows } from "./api"
import { literal, qualified, quoteIdent } from "./sql"
import type { Cell } from "./types"

export type ColumnMeta = {
  name: string
  dataType: string
  columnType: string
  nullable: boolean
  key: string
  default: Cell
  extra: string
  comment: string
  collation: string | null
}

type RawColumnMeta = {
  name: string
  dataType: string
  columnType: string
  nullable: string
  key: string
  default: Cell
  extra: string
  comment: string
  collation: string | null
}

const BINARY_TYPES = new Set(["binary", "varbinary", "blob", "tinyblob", "mediumblob", "longblob", "bit", "geometry", "point", "linestring", "polygon", "multipoint", "multilinestring", "multipolygon", "geometrycollection"])
const TEXT_TYPES = new Set(["text", "tinytext", "mediumtext", "longtext", "json"])

export const isBinary = (c: ColumnMeta) => BINARY_TYPES.has(c.dataType)
export const isLongText = (c: ColumnMeta) => TEXT_TYPES.has(c.dataType)
export const isGenerated = (c: ColumnMeta) => /GENERATED/i.test(c.extra)
export const isAutoIncrement = (c: ColumnMeta) => /auto_increment/i.test(c.extra)

/** Values of an `enum(...)`/`set(...)` column type. */
export function enumValues(c: ColumnMeta) {
  const match = /^(?:enum|set)\((.*)\)$/i.exec(c.columnType)
  if (!match) return null
  return [...match[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replaceAll("''", "'"))
}

export function useTableMeta(database: string, table: string) {
  const columns = useRows<RawColumnMeta>(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS nullable,
      COLUMN_KEY AS \`key\`, COLUMN_DEFAULT AS \`default\`, EXTRA AS extra, COLUMN_COMMENT AS comment,
      COLLATION_NAME AS collation
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [database, table]
  )
  const info = useRows<{ type: string }>(
    "SELECT TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [database, table]
  )
  const meta = columns.rows?.map<ColumnMeta>((c) => ({ ...c, nullable: c.nullable === "YES" }))
  return {
    columns: meta,
    primaryKey: meta?.filter((c) => c.key === "PRI").map((c) => c.name) ?? [],
    isView: info.rows?.[0]?.type === "VIEW",
    exists: info.rows ? info.rows.length > 0 : undefined,
    isLoading: columns.isLoading || info.isLoading,
    mutate: columns.mutate,
  }
}

/**
 * WHERE clause that identifies one row: the primary key when there is one,
 * otherwise every non-binary column (with LIMIT 1 at the call site).
 */
export function rowWhere(columns: ColumnMeta[], primaryKey: string[], row: Record<string, Cell>) {
  const keys = primaryKey.length ? primaryKey : columns.filter((c) => !isBinary(c) && !isLongText(c)).map((c) => c.name)
  return keys
    .map((name) => {
      const column = columns.find((c) => c.name === name)
      return `${quoteIdent(name)} <=> ${literal(row[name], column ? isBinary(column) : false)}`
    })
    .join(" AND ")
}

export function updateSql(
  database: string,
  table: string,
  columns: ColumnMeta[],
  primaryKey: string[],
  original: Record<string, Cell>,
  changes: Record<string, Cell>
) {
  const set = Object.entries(changes)
    .map(([name, value]) => {
      const column = columns.find((c) => c.name === name)
      return `${quoteIdent(name)} = ${literal(value, column ? isBinary(column) : false)}`
    })
    .join(", ")
  return `UPDATE ${qualified(database, table)} SET ${set} WHERE ${rowWhere(columns, primaryKey, original)} LIMIT 1`
}

export function deleteSql(
  database: string,
  table: string,
  columns: ColumnMeta[],
  primaryKey: string[],
  rows: Record<string, Cell>[]
) {
  return rows
    .map((row) => `DELETE FROM ${qualified(database, table)} WHERE ${rowWhere(columns, primaryKey, row)} LIMIT 1;`)
    .join("\n")
}

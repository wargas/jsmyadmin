import type { Cell } from "./types"

export function quoteIdent(name: string) {
  return "`" + name.replaceAll("`", "``") + "`"
}

export function qualified(database: string, table: string) {
  return `${quoteIdent(database)}.${quoteIdent(table)}`
}

const ESCAPES: Record<string, string> = {
  "\0": "\\0",
  "\n": "\\n",
  "\r": "\\r",
  "\x1a": "\\Z",
  "'": "\\'",
  "\\": "\\\\",
}

export function quoteString(value: string) {
  return "'" + value.replace(/[\0\n\r\x1a'\\]/g, (ch) => ESCAPES[ch]) + "'"
}

/** Renders a serialized cell as a SQL literal; `0x…` cells of binary columns stay hex. */
export function literal(value: Cell, binary = false) {
  if (value === null) return "NULL"
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "1" : "0"
  if (binary && /^0x[0-9A-F]*$/i.test(value)) return value === "0x" ? "''" : value
  return quoteString(value)
}

/** ` COLLATE x` for a valid collation name, empty otherwise (collation names can't be quoted). */
export function collateClause(collation: string) {
  return /^\w+$/.test(collation) ? ` COLLATE ${collation}` : ""
}

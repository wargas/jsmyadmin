import "server-only"
import type { Credentials } from "./session"
import type { Cell, Column, StatementResult } from "./types"
import { splitSql } from "./sql-split"
import { quoteIdent } from "./sql"

type Pool = InstanceType<typeof Bun.SQL>
type RawColumn = { name: string; type: number; table: string; flags: number }
type RawResult = unknown[][] & {
  columns?: RawColumn[]
  affectedRows?: number
  lastInsertRowid?: number | bigint
}

// MySQL protocol column type codes.
const TYPE_DATE = 10

const globalForPools = globalThis as unknown as { __jsmyadminPools?: Map<string, Pool> }
const pools = (globalForPools.__jsmyadminPools ??= new Map())

export function getPool(credentials: Credentials) {
  const key = JSON.stringify([credentials.host, credentials.port, credentials.user, credentials.password, credentials.database])
  let pool = pools.get(key)
  if (!pool) {
    pool = new Bun.SQL({
      adapter: "mysql",
      hostname: credentials.host,
      port: credentials.port,
      username: credentials.user,
      password: credentials.password,
      database: credentials.database || undefined,
      allowPublicKeyRetrieval: true,
      max: 5,
      idleTimeout: 60,
    } as ConstructorParameters<typeof Bun.SQL>[0])
    pools.set(key, pool)
  }
  return pool
}

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0")
}

function formatDate(date: Date, type: number) {
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  if (type === TYPE_DATE) return day
  const ms = date.getUTCMilliseconds()
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  return `${day} ${time}${ms ? "." + pad(ms, 3) : ""}`
}

export function serializeValue(value: unknown, type: number): Cell {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "0000-00-00 00:00:00" : formatDate(value, type)
  }
  if (value instanceof Uint8Array) return "0x" + Buffer.from(value).toString("hex").toUpperCase()
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "object") return JSON.stringify(value)
  return value as Cell
}

export function toStatementResult(sql: string, raw: RawResult, durationMs: number): StatementResult {
  // The protocol's binary flag is also set for *_bin collations, so a column
  // counts as binary when the driver hands back raw bytes for it.
  const columns: Column[] = (raw.columns ?? []).map((c, i) => ({
    name: c.name,
    type: c.type,
    table: c.table,
    binary: raw.some((row) => row[i] instanceof Uint8Array),
  }))
  const rows = columns.length
    ? raw.map((row) => row.map((value, i) => serializeValue(value, columns[i]?.type ?? 0)))
    : []
  return {
    sql,
    columns,
    rows,
    affectedRows: raw.affectedRows ?? 0,
    lastInsertId: typeof raw.lastInsertRowid === "bigint" ? raw.lastInsertRowid.toString() : (raw.lastInsertRowid ?? 0),
    durationMs,
  }
}

function errorResult(sql: string, error: unknown, durationMs: number): StatementResult {
  const e = error as { message?: string; code?: string; errno?: number }
  return {
    sql,
    columns: [],
    rows: [],
    affectedRows: 0,
    lastInsertId: 0,
    durationMs,
    error: { message: e.message ?? String(error), code: e.code, errno: e.errno },
  }
}

/**
 * Runs a script statement by statement on one reserved connection, so `USE`
 * and session variables carry over. Stops at the first failing statement.
 */
export async function runScript(
  credentials: Credentials,
  script: string,
  options: { database?: string; params?: Cell[] } = {}
) {
  const statements = options.params ? [script] : splitSql(script)
  const connection = await getPool(credentials).reserve()
  const results: StatementResult[] = []
  try {
    if (options.database) await connection.unsafe(`USE ${quoteIdent(options.database)}`)
    for (const statement of statements) {
      const start = performance.now()
      try {
        const query = options.params ? connection.unsafe(statement, options.params) : connection.unsafe(statement)
        const raw = (await query.values()) as RawResult
        results.push(toStatementResult(statement, raw, performance.now() - start))
      } catch (error) {
        results.push(errorResult(statement, error, performance.now() - start))
        break
      }
    }
  } finally {
    connection.release()
  }
  return results
}

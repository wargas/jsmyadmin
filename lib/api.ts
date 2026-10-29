"use client"

import useSWR, { mutate } from "swr"
import type { Cell, QueryResponse, StatementResult } from "./types"

export class SqlError extends Error {
  constructor(public result: StatementResult) {
    super(result.error?.message ?? "Query failed")
  }
}

/** Runs a script and returns every statement's result (errors included). */
export async function runSql(sql: string, options: { database?: string; params?: Cell[] } = {}) {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, ...options }),
  })
  if (response.status === 401) {
    // Full reload so every cached query and the session state are dropped.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login"
    throw new Error("Session expired")
  }
  const body = (await response.json()) as QueryResponse & { error?: string }
  if (!response.ok) throw new Error(body.error ?? response.statusText)
  return body.results
}

/** Runs a script and throws on the first failing statement; returns the last result. */
export async function exec(sql: string, options: { database?: string; params?: Cell[] } = {}) {
  const results = await runSql(sql, options)
  const failed = results.find((r) => r.error)
  if (failed) throw new SqlError(failed)
  return results[results.length - 1]
}

/** Maps a result's rows to objects keyed by column name. */
export function toObjects<T = Record<string, Cell>>(result: StatementResult): T[] {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((c, i) => [c.name, row[i]])) as T)
}


export function useQuery(sql: string | null, params?: Cell[], database?: string) {
  return useSWR(sql ? (["sql", sql, params, database] as const) : null, ([, s, p, d]) =>
    exec(s, { params: p, database: d })
  )
}

export function useRows<T = Record<string, Cell>>(sql: string | null, params?: Cell[], database?: string) {
  const query = useQuery(sql, params, database)
  return { ...query, rows: query.data ? toObjects<T>(query.data) : undefined }
}

/** Revalidates every cached query (after DDL, the sidebar and lists change). */
export function refreshAll() {
  return mutate((key) => Array.isArray(key) && key[0] === "sql")
}


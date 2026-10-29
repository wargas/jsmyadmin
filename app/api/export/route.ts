import { getPool, toStatementResult } from "@/lib/db"
import { getCredentials, unauthorized } from "@/lib/session"
import { literal, qualified, quoteIdent } from "@/lib/sql"

const BATCH = 500

type Format = "sql" | "csv" | "json"

export async function GET(request: Request) {
  const credentials = await getCredentials()
  if (!credentials) return unauthorized()

  const url = new URL(request.url)
  const database = url.searchParams.get("db")
  const table = url.searchParams.get("table")
  const format = (url.searchParams.get("format") ?? "sql") as Format
  const withStructure = url.searchParams.get("structure") !== "0"
  const withData = url.searchParams.get("data") !== "0"
  if (!database) return Response.json({ error: "Missing db" }, { status: 400 })
  if (format !== "sql" && !table) return Response.json({ error: "CSV/JSON export needs a table" }, { status: 400 })

  const sql = getPool(credentials)
  const select = async (query: string, params: unknown[] = []) => {
    const raw = await sql.unsafe(query, params).values()
    return toStatementResult(query, raw as never, 0)
  }

  const tables = table
    ? [{ name: table, view: false }]
    : (
        await select(
          "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_TYPE, TABLE_NAME",
          [database]
        )
      ).rows.map((r) => ({ name: String(r[0]), view: r[1] === "VIEW" }))

  if (table) {
    const kind = await select(
      "SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [database, table]
    )
    tables[0].view = kind.rows[0]?.[0] === "VIEW"
  }

  async function* batches(name: string) {
    for (let offset = 0; ; offset += BATCH) {
      const page = await select(`SELECT * FROM ${qualified(database!, name)} LIMIT ${BATCH} OFFSET ${offset}`)
      if (page.rows.length) yield page
      if (page.rows.length < BATCH) return
    }
  }

  async function* sqlDump() {
    yield `-- jsmyadmin SQL dump\n-- Database: ${database}\n-- Generated: ${new Date().toISOString()}\n\n`
    yield "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n"
    for (const { name, view } of tables) {
      if (withStructure) {
        const create = await select(`SHOW CREATE ${view ? "VIEW" : "TABLE"} ${qualified(database!, name)}`)
        yield `-- ${view ? "View" : "Table"} ${quoteIdent(name)}\n`
        yield `DROP ${view ? "VIEW" : "TABLE"} IF EXISTS ${quoteIdent(name)};\n${create.rows[0][1]};\n\n`
      }
      if (!withData || view) continue
      for await (const page of batches(name)) {
        const columns = page.columns.map((c) => quoteIdent(c.name)).join(", ")
        const values = page.rows
          .map((row) => "(" + row.map((v, i) => literal(v, page.columns[i].binary)).join(", ") + ")")
          .join(",\n")
        yield `INSERT INTO ${quoteIdent(name)} (${columns}) VALUES\n${values};\n`
      }
      yield "\n"
    }
    yield "SET FOREIGN_KEY_CHECKS = 1;\n"
  }

  async function* csvDump() {
    const escape = (v: unknown) => {
      if (v === null) return "NULL"
      const s = String(v)
      return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
    }
    let header = true
    for await (const page of batches(table!)) {
      if (header) yield page.columns.map((c) => escape(c.name)).join(",") + "\n"
      header = false
      for (const row of page.rows) yield row.map(escape).join(",") + "\n"
    }
  }

  async function* jsonDump() {
    yield "["
    let first = true
    for await (const page of batches(table!)) {
      for (const row of page.rows) {
        const object = Object.fromEntries(page.columns.map((c, i) => [c.name, row[i]]))
        yield (first ? "\n  " : ",\n  ") + JSON.stringify(object)
        first = false
      }
    }
    yield "\n]\n"
  }

  const generators: Record<Format, () => AsyncGenerator<string>> = { sql: sqlDump, csv: csvDump, json: jsonDump }
  const iterator = generators[format]()
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next()
        if (done) controller.close()
        else controller.enqueue(encoder.encode(value))
      } catch (error) {
        controller.enqueue(encoder.encode(`\n-- Export failed: ${(error as Error).message}\n`))
        controller.close()
      }
    },
  })

  const filename = `${table ?? database}.${format}`
  return new Response(stream, {
    headers: {
      "Content-Type": format === "json" ? "application/json" : format === "csv" ? "text/csv" : "application/sql",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}


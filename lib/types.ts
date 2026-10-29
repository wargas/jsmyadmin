export type Column = {
  name: string
  type: number
  table: string
  binary: boolean
}

export type Cell = string | number | boolean | null

export type StatementResult = {
  sql: string
  columns: Column[]
  rows: Cell[][]
  affectedRows: number
  lastInsertId: number | string
  durationMs: number
  error?: { message: string; code?: string; errno?: number }
}

export type QueryRequest = {
  sql: string
  params?: Cell[]
  database?: string
}

export type QueryResponse = {
  results: StatementResult[]
}

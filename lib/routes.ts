export const databaseHref = (database: string) => `/db/${encodeURIComponent(database)}`

export const tableHref = (database: string, table: string) =>
  `/db/${encodeURIComponent(database)}/${encodeURIComponent(table)}`

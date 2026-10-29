export type ConnectionFields = {
  host: string
  port: number
  user: string
  password: string
  database?: string
  tls?: boolean
}

const PROTOCOLS = new Set(["mysql:", "mysql2:", "mariadb:"])
const TLS_ON = new Set(["true", "1", "required", "require", "verify-ca", "verify-full", "verify_ca", "verify_identity"])

/**
 * Parses `mysql://user:password@host:port/database?ssl=true`.
 * Credentials may be percent-encoded; `ssl`, `tls` and `sslmode` enable TLS.
 */
export function parseConnectionUrl(input: string): ConnectionFields {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error("URL inválida. Use mysql://usuario:senha@host:3306/banco")
  }
  if (!PROTOCOLS.has(url.protocol)) throw new Error(`Protocolo não suportado: ${url.protocol} (use mysql://)`)
  if (!url.hostname) throw new Error("A URL precisa informar o host")

  const flag = ["ssl", "tls", "sslmode", "ssl-mode"].map((key) => url.searchParams.get(key)?.toLowerCase()).find(Boolean)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""))

  return {
    // IPv6 hosts come back bracketed ("[::1]").
    host: url.hostname.replace(/^\[(.*)\]$/, "$1"),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username) || "root",
    password: decodeURIComponent(url.password),
    database: database || undefined,
    tls: flag ? TLS_ON.has(flag) : undefined,
  }
}

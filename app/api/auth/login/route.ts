import { parseConnectionUrl } from "@/lib/connection-url"
import { closePool, getPool } from "@/lib/db"
import { isSecureRequest, setCredentials, type Credentials } from "@/lib/session"

// Comma-separated MySQL hosts users may connect to; empty allows any host.
const ALLOWED_HOSTS = (process.env.MYSQL_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<Record<keyof Credentials | "url", string>>
  let credentials: Credentials
  if (body.url) {
    try {
      credentials = parseConnectionUrl(body.url)
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400 })
    }
  } else {
    credentials = {
      host: body.host?.trim() || "localhost",
      port: Number(body.port) || 3306,
      user: body.user?.trim() || "root",
      password: body.password ?? "",
      database: body.database?.trim() || undefined,
      tls: body.tls === "on" || undefined,
    }
  }

  if (ALLOWED_HOSTS.length && !ALLOWED_HOSTS.includes(credentials.host.toLowerCase())) {
    return Response.json({ error: `Host não permitido: ${credentials.host}` }, { status: 403 })
  }

  try {
    const [row] = await getPool(credentials).unsafe("SELECT VERSION() AS version")
    await setCredentials(credentials, { secure: isSecureRequest(request) })
    return Response.json({ version: row.version, database: credentials.database ?? null })
  } catch (error) {
    await closePool(credentials)
    return Response.json({ error: (error as Error).message }, { status: 401 })
  }
}

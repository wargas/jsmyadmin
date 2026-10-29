import { runScript } from "@/lib/db"
import { getCredentials, unauthorized } from "@/lib/session"
import type { QueryRequest } from "@/lib/types"

export async function POST(request: Request) {
  const credentials = await getCredentials()
  if (!credentials) return unauthorized()

  const { sql, params, database } = (await request.json()) as QueryRequest
  try {
    const results = await runScript(credentials, sql, { params, database })
    return Response.json({ results })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}

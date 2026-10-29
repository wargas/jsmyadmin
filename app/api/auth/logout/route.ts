import { clearCredentials } from "@/lib/session"

export async function POST() {
  await clearCredentials()
  return Response.json({ ok: true })
}

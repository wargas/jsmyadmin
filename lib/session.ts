import "server-only"
import { cookies } from "next/headers"

export type Credentials = {
  host: string
  port: number
  user: string
  password: string
  /** Optional default database for the connection. */
  database?: string
  tls?: boolean
}

export const SESSION_COOKIE = "jsmyadmin_session"

const globalForKey = globalThis as unknown as { __jsmyadminKey?: Promise<CryptoKey> }

// Without SESSION_SECRET, development uses a fixed key (sessions survive
// restarts) and production a random one per process (sessions end on restart).
function getKey() {
  globalForKey.__jsmyadminKey ??= (async () => {
    let secret = process.env.SESSION_SECRET
    if (!secret && process.env.NODE_ENV === "production") {
      console.warn("[jsmyadmin] SESSION_SECRET is not set; using a random key for this process.")
      return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    }
    secret ||= "jsmyadmin-development-only"
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
    return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"])
  })()
  return globalForKey.__jsmyadminKey
}

async function seal(data: Credentials) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), plain))
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return Buffer.from(out).toString("base64url")
}

async function unseal(token: string): Promise<Credentials | null> {
  try {
    const bytes = Buffer.from(token, "base64url")
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, 12) },
      await getKey(),
      bytes.subarray(12)
    )
    return JSON.parse(new TextDecoder().decode(plain))
  } catch {
    return null
  }
}

export async function getCredentials() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? unseal(token) : null
}

/**
 * `secure` follows the request protocol (honouring a TLS-terminating proxy's
 * X-Forwarded-Proto) unless COOKIE_SECURE forces it, so plain-HTTP deploys
 * still get a session cookie the browser keeps.
 */
export function isSecureRequest(request: Request) {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true"
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
  return (proto ?? new URL(request.url).protocol.replace(":", "")) === "https"
}

export async function setCredentials(credentials: Credentials, options: { secure: boolean }) {
  ;(await cookies()).set(SESSION_COOKIE, await seal(credentials), {
    httpOnly: true,
    sameSite: "strict",
    secure: options.secure,
    path: "/",
  })
}

/** 401 for a missing or unreadable session; drops the cookie so the login page isn't bounced back. */
export async function unauthorized() {
  await clearCredentials()
  return Response.json({ error: "Not authenticated" }, { status: 401 })
}

export async function clearCredentials() {
  ;(await cookies()).delete(SESSION_COOKIE)
}

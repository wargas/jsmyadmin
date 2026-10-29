import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "jsmyadmin_session"

// Only checks that a session cookie exists; API routes validate it (and clear
// it when unreadable). /login is always reachable: the proxy can't tell a
// valid cookie from a stale one, so bouncing it to "/" would loop.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login" || request.cookies.has(SESSION_COOKIE)) return NextResponse.next()
  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

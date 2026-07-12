import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic check only (reads the session cookie via Auth.js, no extra DB round trip
// beyond what the "database" session strategy already does through auth()). This is NOT
// the authoritative auth boundary — every Server Action re-checks the session itself.
const PUBLIC_PATHS = ["/sign-in"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname.startsWith("/api/auth");

  if (!req.auth && !isPublic && !isAuthApi) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

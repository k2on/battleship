// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const TEST_PASSWORD = process.env.TEST_PASSWORD!;

export function middleware(request: NextRequest) {
  const { method } = request;
  const { pathname, search } = request.nextUrl;

  // Log every request
  console.log(`${method} ${pathname}${search}`);

  // Proxy check for /api/test/* routes
  if (pathname.startsWith("/api/test")) {
    const testHeader = request.headers.get("X-Test-Mode");
    if (!testHeader || testHeader !== TEST_PASSWORD) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

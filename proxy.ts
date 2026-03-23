import { NextRequest, NextResponse } from "next/server";

const TEST_PASSWORD = process.env.TEST_PASSWORD!;

export function proxy(request: NextRequest) {
  const { method } = request;
  const { pathname, search } = request.nextUrl;

  // Log every request
  console.log(`${method} ${pathname}${search}`);

  // Test mode auth check (only for /api/test routes)
  if (pathname.startsWith("/api/test")) {
    const testHeader = request.headers.get("X-Test-Mode");
    if (!testHeader || testHeader !== TEST_PASSWORD) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

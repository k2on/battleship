import { NextRequest, NextResponse } from "next/server";

const TEST_PASSWORD = process.env.TEST_PASSWORD!;

export function proxy(request: NextRequest) {
  const testHeader = request.headers.get("X-Test-Mode");

  if (!testHeader || testHeader !== TEST_PASSWORD) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/test/:path*",
};

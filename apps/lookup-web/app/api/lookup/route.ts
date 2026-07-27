import { NextRequest, NextResponse } from "next/server"

const API_URL = process.env.OATI_LOOKUP_API_URL ?? "http://localhost:8080/oati/v1"

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type")
  const id = request.nextUrl.searchParams.get("id")

  if (!type || !id) {
    return NextResponse.json({ error: "type_and_id_required" }, { status: 400 })
  }

  const response = await fetch(
    `${API_URL}/lookup?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    }
  ).catch(() => null)

  if (!response) {
    return NextResponse.json({ error: "lookup_service_unavailable" }, { status: 503 })
  }

  const body: unknown = await response.json()
  return NextResponse.json(body, {
    status: response.status,
    headers: {
      "X-RateLimit-Limit": response.headers.get("X-RateLimit-Limit") ?? "",
      "X-RateLimit-Remaining": response.headers.get("X-RateLimit-Remaining") ?? "",
    },
  })
}

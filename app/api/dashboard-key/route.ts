import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()
    const secret = process.env.DASHBOARD_ACCESS_KEY

    if (!secret) {
      return NextResponse.json(
        { valid: false, error: "Server not configured" },
        { status: 500 }
      )
    }

    const valid = typeof key === "string" && key === secret

    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json(
      { valid: false, error: "Invalid request" },
      { status: 400 }
    )
  }
}

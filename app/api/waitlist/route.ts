import { neon } from "@neondatabase/serverless"
import { NextRequest, NextResponse } from "next/server"

function getDb() {
  const url = process.env.POSTGRES_URL
  if (!url) throw new Error("POSTGRES_URL is not set")
  return neon(url)
}

// POST — add an email to the waitlist
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const sql = getDb()

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Insert email (ignore duplicates)
    await sql`
      INSERT INTO waitlist (email)
      VALUES (${email.toLowerCase().trim()})
      ON CONFLICT (email) DO NOTHING
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Waitlist error:", err)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}

// GET — list all waitlist entries (protected by dashboard key)
export async function GET(req: NextRequest) {
  try {
    const authKey = req.headers.get("x-access-key")
    const secret = process.env.DASHBOARD_ACCESS_KEY

    if (!secret || authKey !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sql = getDb()

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    const rows = await sql`
      SELECT id, email, created_at FROM waitlist ORDER BY created_at DESC
    `

    return NextResponse.json({ emails: rows, count: rows.length })
  } catch (err) {
    console.error("Waitlist GET error:", err)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // Parse but don't use the parameters for now
  await req.json()
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { trackEvent } from '../../../lib/metrics'

export async function POST(req: Request) {
  const body = await req.json()
  await trackEvent(body.event || 'unknown', body)
  return NextResponse.json({ ok: true })
}

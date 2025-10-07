import { NextResponse } from 'next/server'
import { deleteFromStorage } from '../../../lib/storage'

export async function POST(req: Request) {
  const { publicId } = await req.json()
  if (publicId) {
    const ok = await deleteFromStorage(publicId)
    return NextResponse.json({ ok })
  }
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { deleteFromStorage } from '../../../../lib/storage'

const REG_PATH = path.join(process.cwd(), 'data', 'generated_images.json')

async function readRegistry() {
  const txt = await fs.readFile(REG_PATH, 'utf8').catch(() => '[]')
  return JSON.parse(txt || '[]')
}

type RegistryItem = { publicId: string; url: string; createdAt: number; sessionId?: string | null }

async function writeRegistry(arr: RegistryItem[]) {
  await fs.writeFile(REG_PATH, JSON.stringify(arr, null, 2), 'utf8')
}

export async function GET() {
  const arr = await readRegistry()
  return NextResponse.json({ ok: true, data: arr })
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json() as { publicId?: string }
    const publicId = body.publicId
    if (!publicId) return NextResponse.json({ ok: false, error: 'missing publicId' }, { status: 400 })
    const arr = await readRegistry() as RegistryItem[]
    const keep = arr.filter((i) => i.publicId !== publicId)
    await writeRegistry(keep)
    // best-effort delete from storage
    try { await deleteFromStorage(publicId) } catch { /* ignore */ }
    return NextResponse.json({ ok: true, removed: publicId })
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

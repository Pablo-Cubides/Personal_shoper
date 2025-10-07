import sharp from 'sharp'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'public', 'uploads', 'resize-cache')
const MAX_UPSCALE = 1.5 // don't upscale more than 1.5x by default

async function ensureCacheDir() {
  try { await fs.promises.mkdir(CACHE_DIR, { recursive: true }) } catch {}
}

export async function POST(req: Request) {
  try {
    const { imageUrl, targetWidth, targetHeight } = await req.json()
    if (!imageUrl || !targetWidth || !targetHeight) return new Response(JSON.stringify({ error: 'missing' }), { status: 400 })

    await ensureCacheDir()

    const key = crypto.createHash('sha256').update(imageUrl + '|' + targetWidth + 'x' + targetHeight).digest('hex')
    const outPath = path.join(CACHE_DIR, `${key}.jpg`)

  // Helper to convert Node Buffer to ArrayBuffer for Response body
  const bufferToArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)

    // Return cached file if exists
    try {
      const stat = await fs.promises.stat(outPath)
      if (stat.size > 0) {
  const buffer = await fs.promises.readFile(outPath)
  const ab = bufferToArrayBuffer(buffer) as ArrayBuffer
  return new Response(new Uint8Array(ab), { status: 200, headers: { 'content-type': 'image/jpeg' } })
      }
    } catch {}

    const res = await fetch(imageUrl)
    if (!res.ok) return new Response(JSON.stringify({ error: 'failed_fetch' }), { status: 502 })

    const arrayBuffer = await res.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Probe original size using sharp metadata
    const meta = await sharp(inputBuffer).metadata()
    const origW = meta.width || targetWidth
    const origH = meta.height || targetHeight

    // Determine upscale factor and limit
    const scaleW = targetWidth / origW
    const scaleH = targetHeight / origH
    const scale = Math.max(scaleW, scaleH)
    const finalScale = Math.min(scale, MAX_UPSCALE)

    const finalWidth = Math.max(1, Math.round(origW * finalScale))
    const finalHeight = Math.max(1, Math.round(origH * finalScale))

    const outBuffer = await sharp(inputBuffer)
      .resize(finalWidth, finalHeight, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer()

    // save to cache (best-effort)
    try { await fs.promises.writeFile(outPath, outBuffer) } catch {}

  const abOut = bufferToArrayBuffer(outBuffer) as ArrayBuffer
  return new Response(new Uint8Array(abOut), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}

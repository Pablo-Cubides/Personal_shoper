import probe from 'probe-image-size'

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return new Response(JSON.stringify({ error: 'missing' }), { status: 400 })
    const res = await fetch(imageUrl)
    if (!res.ok) return new Response(JSON.stringify({ error: 'failed_fetch' }), { status: 502 })
    const buffer = await res.arrayBuffer()
    const info = probe.sync(Buffer.from(buffer))
    return new Response(JSON.stringify({ width: info.width, height: info.height }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
}

import fs from 'fs/promises'
import path from 'path'
import https from 'https'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'ai_calls.log')

const REMOTE_LOG_URL =
  process.env.BETTERSTACK_LOG_ENDPOINT ||
  process.env.LOGTAIL_URL ||
  process.env.BETTERSTACK_URL ||
  ''
const REMOTE_LOG_TOKEN =
  process.env.BETTERSTACK_TOKEN ||
  process.env.BETTERSTACK_WRITE_KEY ||
  process.env.LOGTAIL_TOKEN ||
  ''
const REMOTE_TIMEOUT_MS = Number.parseInt(process.env.BETTERSTACK_TIMEOUT_MS || '2000', 10)
const LOGTAIL_ALLOW_INSECURE = process.env.LOGTAIL_ALLOW_INSECURE === 'true'

const insecureAgent = LOGTAIL_ALLOW_INSECURE
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined

function safeStringify(entry: Record<string, unknown>): string {
  try {
    return JSON.stringify(entry)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to stringify log entry', error)
    }
    return JSON.stringify({ error: 'failed_to_stringify' })
  }
}

function formatUtcTimestamp(date: Date): string {
  const pad = (input: number) => input.toString().padStart(2, '0')
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const minutes = pad(date.getUTCMinutes())
  const seconds = pad(date.getUTCSeconds())
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
}

async function sendRemoteLog(timestamp: Date, entry: Record<string, unknown>, rawLine: string) {
  if (!REMOTE_LOG_URL || !REMOTE_LOG_TOKEN) return

  const payload = {
    dt: formatUtcTimestamp(timestamp),
    message: typeof entry.phase === 'string' ? entry.phase : 'log event',
    context: {
      ...entry,
      raw: rawLine.trim(),
    },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${REMOTE_LOG_TOKEN}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }

  if (insecureAgent) {
    // @ts-expect-error Node fetch supports agent in RequestInit
    requestInit.agent = insecureAgent
  }

  try {
    await fetch(REMOTE_LOG_URL, requestInit)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Remote logging failed', error)
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function appendLog(entry: Record<string, unknown>) {
  const timestamp = new Date()
  const line = `${timestamp.toISOString()} ${safeStringify(entry)}\n`

  const tasks: Array<Promise<unknown>> = []

  tasks.push(
    (async () => {
      try {
        await fs.mkdir(LOG_DIR, { recursive: true })
        await fs.appendFile(LOG_FILE, line, 'utf8')
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('appendLog error', error)
        }
      }
    })()
  )

  tasks.push(sendRemoteLog(timestamp, entry, line))

  await Promise.allSettled(tasks)
}

export async function readLogs(limit = 200) {
  try {
    const txt = await fs.readFile(LOG_FILE, 'utf8')
    const lines = txt.trim().split('\n').slice(-limit)
    return lines
  } catch {
    return []
  }
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mkdirMock = vi.fn(async () => undefined)
const appendFileMock = vi.fn(async () => undefined)
const readFileMock = vi.fn()

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    appendFile: appendFileMock,
    readFile: readFileMock,
  },
}))

const originalFetch = global.fetch

function resetLogEnv() {
  delete process.env.BETTERSTACK_LOG_ENDPOINT
  delete process.env.BETTERSTACK_URL
  delete process.env.LOGTAIL_URL
  delete process.env.BETTERSTACK_TOKEN
  delete process.env.BETTERSTACK_WRITE_KEY
  delete process.env.LOGTAIL_TOKEN
  delete process.env.BETTERSTACK_TIMEOUT_MS
  delete process.env.LOGTAIL_ALLOW_INSECURE
}

describe('appendLog', () => {
  beforeEach(() => {
    vi.resetModules()
    resetLogEnv()
    mkdirMock.mockClear()
    appendFileMock.mockClear()
    readFileMock.mockReset()
  })

  afterEach(() => {
    resetLogEnv()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends remote payload to Better Stack when configured', async () => {
    const remoteFetch = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = remoteFetch as unknown as typeof fetch

    process.env.BETTERSTACK_LOG_ENDPOINT = 'https://in.logtail.com/'
    process.env.BETTERSTACK_TOKEN = 'secret-token'

    const { appendLog } = await import('../lib/ai/logger')

    await appendLog({ phase: 'test.phase', foo: 'bar' })

    expect(mkdirMock).toHaveBeenCalled()
    expect(appendFileMock).toHaveBeenCalled()
    expect(remoteFetch).toHaveBeenCalledTimes(1)

    const [url, init] = remoteFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://in.logtail.com/')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer secret-token',
    })

    const payload = JSON.parse(init.body as string)
    expect(payload).toHaveProperty('dt')
    expect(payload).toHaveProperty('message', 'test.phase')
    expect(payload.context).toMatchObject({ foo: 'bar' })
    expect(payload.context.raw).toContain('"phase":"test.phase"')
  })

  it('resolves gracefully when remote logging fails', async () => {
    const remoteFetch = vi.fn().mockRejectedValue(new Error('network error'))
    global.fetch = remoteFetch as unknown as typeof fetch

    process.env.BETTERSTACK_LOG_ENDPOINT = 'https://in.logtail.com/'
    process.env.BETTERSTACK_TOKEN = 'secret-token'

    const { appendLog } = await import('../lib/ai/logger')

    await expect(appendLog({ phase: 'test.failure' })).resolves.not.toThrow()

    expect(mkdirMock).toHaveBeenCalled()
    expect(appendFileMock).toHaveBeenCalled()
    expect(remoteFetch).toHaveBeenCalledTimes(1)
  })
})

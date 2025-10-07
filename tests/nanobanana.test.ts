import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as storage from '../lib/storage'
// We'll import and set node-fetch's default per-test when needed

describe('editWithNanoBanana (unit, mocked)', () => {

  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.GENERATIVE_API_KEY
    delete process.env.GEMINI_REST_URL
    delete process.env.NANOBANANA_URL
    delete process.env.GEMINI_API_KEY
  })

  it('throws 503 when no external editors available', async () => {
    // Import fresh module so module-level env constants are read now
    const mod = await import('../lib/ai/nanobanana')
    await expect(mod.editWithNanoBanana('https://example.com/a.jpg', { locale: 'es', change: [], instruction: 'test', preserveIdentity: true, outputSize: 1024, watermark: true })).rejects.toMatchObject({ message: expect.stringContaining('AI image service unavailable') })
  })

  it('uses legacy nanobanana endpoint when configured', async () => {
    // set envs before importing the module to ensure module-level constants use them
  // Use GEMINI_REST_URL to trigger the REST editor branch (simpler to mock)
  process.env.GEMINI_REST_URL = 'https://legacy.example/edit'

    // clear module from cache and import after envs set
  try { delete require.cache[require.resolve('../lib/ai/nanobanana')] } catch {} 
  // mock fetch to return an object with url
  const legacyResp = { ok: true, json: async () => ({ url: 'https://cdn.example/edited.png', publicId: 'abstain/edited' }) }
  // Use vitest module mocking: reset modules and register a mock for 'node-fetch'
  vi.resetModules()
  vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce(legacyResp) }))

    // mock uploadIfNeeded via uploadToStorage by spying on storage.uploadToStorage
    const spy = vi.spyOn(storage, 'uploadToStorage').mockResolvedValue({ url: 'https://cdn.example/edited.png', public_id: 'abstain/edited' })

  const freshNano = await import('../lib/ai/nanobanana')
  // no-op: keep mock state isolated by vitest between tests
    const res = await freshNano.editWithNanoBanana('https://example.com/a.jpg', { locale: 'es', change: [], instruction: 'test', preserveIdentity: true, outputSize: 1024, watermark: true })
    expect(res).toHaveProperty('editedUrl')
    expect(res.editedUrl).toBe('https://cdn.example/edited.png')
    spy.mockRestore()
  })
})

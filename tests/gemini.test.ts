import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fetch from 'node-fetch'
import * as gemini from '../lib/ai/gemini'

// Mock node-fetch globally where used in gemini.ts
vi.mock('node-fetch', () => ({ default: vi.fn() }))

describe('analyzeImageWithGemini (unit, mocked)', () => {
  const mockFetch = fetch as unknown as { default: (...args: unknown[]) => Promise<unknown> }

  beforeEach(() => {
    vi.resetAllMocks()
    // ensure GEMINI env not set so function hits fallback vision path
    delete process.env.GEMINI_API_KEY
    // ensure vision key exists for fallback branch (value unused because fetch is mocked)
    process.env.GOOGLE_VISION_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_VISION_API_KEY
  })

  it('returns default analysis when Gemini unavailable but vision response present', async () => {
    // mock fetch for vision API call used in fallback
    const fakeVisionResp = { responses: [ { faceAnnotations: [{},], imagePropertiesAnnotation: { dominantColors: { colors: [{ color: { red: 10, green: 10, blue: 10 } }] } }, safeSearchAnnotation: {} } ] }
    // first fetch in analyzeImageWithGemini will be towards vision API; mock to return JSON
    const m = vi.fn()
    m.mockResolvedValueOnce({ ok: true, json: async () => fakeVisionResp })
    // subsequent unrelated fetches can return ok false
    mockFetch.default = m

    const res = await gemini.analyzeImageWithGemini('https://example.com/test.jpg', 'es')
    expect(res).toHaveProperty('faceOk')
    expect(res).toHaveProperty('hair')
    expect(typeof res.suggestedText === 'string').toBe(true)
  })
})

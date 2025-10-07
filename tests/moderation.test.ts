import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const appendLogMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('../lib/ai/logger', () => ({
  appendLog: appendLogMock,
}))

vi.mock('node-fetch', () => ({
  __esModule: true,
  default: fetchMock,
}))

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getClient: vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'fake-token' }),
    }),
  })),
}))

async function loadModeration() {
  return import('../lib/moderation')
}

function resetVisionEnv() {
  delete process.env.GOOGLE_VISION_API_KEY
  delete process.env.GC_VISION_API_KEY
  delete process.env.GCP_VISION_API_KEY
  delete process.env.GOOGLE_API_KEY
  delete process.env.GEMINI_API_KEY
  delete process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH
}

describe('moderateImage', () => {
  const imageUrl = 'https://example.com/photo.jpg'

  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    appendLogMock.mockReset()
    resetVisionEnv()
  })

  afterEach(() => {
    resetVisionEnv()
  })

  it('falls back to basic fetch when no API key is configured', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.no_access_token')
    expect(phases).toContain('moderation.fallback_passed')
  })

  it('blocks images flagged as NSFW by SafeSearch', async () => {
    process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH = 'fake-path'

    // Mock image download
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-image-data'),
      headers: { get: () => 'image/jpeg' }
    } as unknown as Response)

    // Mock Vision API response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responses: [
          {
            safeSearchAnnotation: { adult: 'VERY_LIKELY', violence: 'POSSIBLE' },
            faceAnnotations: [{}],
          },
        ],
      }),
    })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: false, reason: 'nsfw' })
    expect(fetchMock).toHaveBeenCalledTimes(2) // image download + vision
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.blocked')
  })

  it('blocks multi-face images', async () => {
    process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH = 'fake-path'

    // Mock image download
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-image-data'),
    } as unknown as Response)

    // Mock Vision API response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responses: [
          {
            safeSearchAnnotation: { adult: 'VERY_UNLIKELY' },
            faceAnnotations: [{}, {}],
          },
        ],
      }),
    })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: false, reason: 'multi_face' })
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.blocked')
  })

  it('blocks when minor-related labels detected with high confidence', async () => {
    process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH = 'fake-path'

    // Mock image download
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-image-data'),
    } as unknown as Response)

    // Mock Vision API response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responses: [
          {
            safeSearchAnnotation: { adult: 'VERY_UNLIKELY' },
            faceAnnotations: [{}],
            labelAnnotations: [
              { description: 'Child', score: 0.92 },
              { description: 'Portrait', score: 0.8 },
            ],
          },
        ],
      }),
    })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: false, reason: 'minor' })
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.blocked')
  })

  it('returns ok when Vision approves a single-face adult image', async () => {
    process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH = 'fake-path'

    // Mock image download
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-image-data'),
    } as unknown as Response)

    // Mock Vision API response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        responses: [
          {
            safeSearchAnnotation: {
              adult: 'VERY_UNLIKELY',
              violence: 'UNLIKELY',
              racy: 'UNLIKELY',
              medical: 'UNLIKELY',
            },
            faceAnnotations: [{}],
            labelAnnotations: [
              { description: 'Person', score: 0.9 },
            ],
          },
        ],
      }),
    })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: true })
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.passed')
  })

  it('falls back when Vision request fails hard', async () => {
    process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH = 'fake-path'

    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true })

    const { moderateImage } = await loadModeration()
    const result = await moderateImage(imageUrl)

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const phases = appendLogMock.mock.calls.map(([entry]) => entry?.phase)
    expect(phases).toContain('moderation.error')
    expect(phases).toContain('moderation.fallback_passed')
  })
})

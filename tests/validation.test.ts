import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('image validation utilities', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('validateUploadedFile rejects large files and wrong mime types', async () => {
    // mock logger
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    // set small max size via env before importing config
    process.env.MAX_IMAGE_SIZE_MB = '0'
    const { validateUploadedFile } = await import('../lib/validation/image')

    const tooBigFile = {
      size: 1024 * 1024,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(1)
    } as unknown as File

    const res = await validateUploadedFile(tooBigFile)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('File size exceeds')

    // invalid mime
    process.env.MAX_IMAGE_SIZE_MB = '10'
    const badMimeFile = {
      size: 100,
      type: 'application/octet-stream',
      arrayBuffer: async () => new ArrayBuffer(1)
    } as unknown as File

    const res2 = await validateUploadedFile(badMimeFile)
    expect(res2.valid).toBe(false)
    expect(res2.error).toContain('Invalid file type')
  })

  it('validateImageUrl handles fetch errors and validates metadata', async () => {
    // mock logger
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))

    // Mock node-fetch for non-ok
  vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }) }))
  const { validateImageUrl } = await import('../lib/validation/image')

    const res = await validateImageUrl('https://example.com/notfound.jpg')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('Failed to fetch image')

    // Now mock a valid fetch but disallowed content-type
    vi.resetModules()
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    const fakeResp = {
      ok: true,
      // node-fetch Response headers can be a Map - cast to unknown then Headers-like for test
      headers: new Map([['content-type', 'application/pdf']]) as unknown as Headers,
      arrayBuffer: async () => new Uint8Array([1,2,3]).buffer
    }
    vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce(fakeResp) }))
    const { validateImageUrl: v2 } = await import('../lib/validation/image')
    const res2 = await v2('https://example.com/file.pdf')
    expect(res2.valid).toBe(false)
    expect(res2.error).toContain('Invalid content type')

    // Finally, test getImageBuffer success
    vi.resetModules()
    vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer }) }))
    const { getImageBuffer: gb } = await import('../lib/validation/image')
    const buf = await gb('https://example.com/img.jpg')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('calculateImageHash returns stable sha256', async () => {
    const { calculateImageHash } = await import('../lib/validation/image')
    const h = calculateImageHash(Buffer.from('hello'))
    expect(typeof h).toBe('string')
    expect(h.length).toBeGreaterThan(10)
  })

  it('should handle corrupted image files', async () => {
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    process.env.MAX_IMAGE_SIZE_MB = '10'
    const { validateUploadedFile } = await import('../lib/validation/image')

    const corruptedFile = {
      size: 1000,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(0) // Empty buffer simulates corruption
    } as unknown as File

    const res = await validateUploadedFile(corruptedFile)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('corrupted')
  })

  it('should reject images below minimum dimensions', async () => {
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    // Mock both node-fetch and probe-image-size
    vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: async () => new Uint8Array([1,2,3]).buffer
    }) }))
    vi.doMock('probe-image-size', () => ({
      default: { sync: vi.fn().mockReturnValue({ width: 100, height: 100 }) } // Too small
    }))

    const { validateImageUrl } = await import('../lib/validation/image')
    const res = await validateImageUrl('https://example.com/small.jpg')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('too small')
  })

  it('should reject images above maximum dimensions', async () => {
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    // Mock both node-fetch and probe-image-size
    vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: async () => new Uint8Array([1,2,3]).buffer
    }) }))
    vi.doMock('probe-image-size', () => ({
      default: { sync: vi.fn().mockReturnValue({ width: 5000, height: 5000 }) } // Above max
    }))

    const { validateImageUrl } = await import('../lib/validation/image')
    const res = await validateImageUrl('https://example.com/large.jpg')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('too large')
  })

  it('should handle network timeouts during image validation', async () => {
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    vi.doMock('node-fetch', () => ({
      default: vi.fn().mockRejectedValueOnce(new Error('Timeout'))
    }));

    const { validateImageUrl } = await import('../lib/validation/image')
    const res = await validateImageUrl('https://example.com/timeout.jpg')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('Failed to validate image URL')
  })

  it('should validate image metadata extraction', async () => {
    vi.doMock('../lib/ai/logger', () => ({ appendLog: vi.fn(), readLogs: vi.fn() }))
    // Mock both node-fetch and probe-image-size
    vi.doMock('node-fetch', () => ({ default: vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: async () => new Uint8Array([1,2,3]).buffer
    }) }))
    vi.doMock('probe-image-size', () => ({
      default: { sync: vi.fn().mockReturnValue({
        width: 1024,
        height: 1024,
        type: 'jpg',
        mime: 'image/jpeg'
      }) }
    }))

    const { validateImageUrl } = await import('../lib/validation/image')
    const res = await validateImageUrl('https://example.com/valid.jpg')
    expect(res.valid).toBe(true)
  })
})

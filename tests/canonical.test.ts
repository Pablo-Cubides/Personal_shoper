import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('canonical URL and dimension consistency', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('ensures before (canonical) and after (edited) images have identical dimensions for the slider', async () => {
    const fakePublicId = 'abstain/test_image_12345'
    const uploadUrl = 'https://cdn.example/cloudinary_variant.jpg'
    const canonicalUrl = 'https://cdn.example/canonical.jpg'
    const editedUrl = 'https://cdn.example/edited.jpg'

    // Mock storage to return uploadUrl and a canonical URL
    vi.doMock('../lib/storage', async () => {
      const actual = await vi.importActual('../lib/storage')
      return {
        ...actual,
        uploadToStorage: vi.fn().mockResolvedValue({ url: uploadUrl, public_id: fakePublicId }),
        getCanonicalUrl: vi.fn().mockReturnValue(canonicalUrl),
      }
    })

    // Mock probe-image-size.sync to return dimensions based on buffer contents
    vi.doMock('probe-image-size', () => ({
      default: {
        sync: (buffer: Buffer) => {
          const s = buffer.toString('utf8')
          if (s.includes('cloudinary_variant')) return { width: 1000, height: 1500, type: 'jpeg', length: buffer.length }
          if (s.includes('canonical')) return { width: 1024, height: 1536, type: 'jpeg', length: buffer.length }
          if (s.includes('edited')) return { width: 1024, height: 1536, type: 'jpeg', length: buffer.length }
          return { width: 100, height: 100, type: 'png', length: buffer.length }
        }
      }
    }))

    // Mock node-fetch to return arrayBuffers that contain identifying strings
    vi.doMock('node-fetch', () => ({
      default: vi.fn().mockImplementation(async (url: string) => {
        if (url === uploadUrl) {
          return { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => Buffer.from('cloudinary_variant').buffer }
        }
        if (url === canonicalUrl) {
          return { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => Buffer.from('canonical').buffer }
        }
        if (url === editedUrl) {
          return { ok: true, headers: new Map([['content-type', 'image/jpeg']]), arrayBuffer: async () => Buffer.from('edited').buffer }
        }
        return { ok: false, status: 404 }
      })
    }))

    // Import modules after mocks are in place
    const storage = await import('../lib/storage')
    const validation = await import('../lib/validation/image')

    // Simulate upload
    const uploaded = await storage.uploadToStorage(Buffer.from('fake'), 'file.jpg')
    expect(uploaded.url).toBe(uploadUrl)

    const canonical = storage.getCanonicalUrl(uploaded.public_id)
    expect(canonical).toBe(canonicalUrl)

    // Validate 'before' image using canonical URL (what the UI will show as Antes)
    const before = await validation.validateImageUrl(canonical)
    expect(before.valid).toBe(true)
    expect(before.details?.width).toBe(1024)
    expect(before.details?.height).toBe(1536)

    // Validate 'after' image (edited) should preserve original input dims
    const after = await validation.validateImageUrl(editedUrl)
    expect(after.valid).toBe(true)
    expect(after.details?.width).toBe(1024)
    expect(after.details?.height).toBe(1536)

    // Final assertion: before and after dimensions are exactly equal
    expect(before.details?.width).toBe(after.details?.width)
    expect(before.details?.height).toBe(after.details?.height)
  }, 20000)
})

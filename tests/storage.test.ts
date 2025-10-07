import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { uploadToStorage, deleteFromStorage } from '../lib/storage'

describe('storage local fallback', () => {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  const filename = 'test_image_ä.png'
  const buffer = Buffer.from('hello')

  beforeAll(async () => {
    // Ensure CLOUDINARY_URL is not considered available for these tests
    process.env.CLOUDINARY_URL = ''
  })

  afterAll(async () => {
    // cleanup uploads dir
    try {
      const p = path.join(uploadsDir, filename.replace(/[^a-zA-Z0-9._-]/g, '_'))
      await fs.unlink(p).catch(() => null)
  } catch {}
  })

  it('saves to public/uploads when cloudinary not configured', async () => {
    const res = await uploadToStorage(buffer, filename)
    expect(res.url).toContain('/uploads/')
    expect(res.public_id).toContain('local:')
    // file should exist
    const p = path.join(process.cwd(), 'public', 'uploads', filename.replace(/[^a-zA-Z0-9._-]/g, '_'))
    const stat = await fs.stat(p)
    expect(stat.isFile()).toBe(true)
  })

  it('deleteFromStorage removes local file without throwing', async () => {
    const publicId = `local:${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const ok = await deleteFromStorage(publicId)
    expect(ok).toBe(true)
  })
})

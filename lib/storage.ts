// cloudinary types can be problematic in some environments; import dynamically at runtime
// Minimal Cloudinary v2 shape used in this file
type CloudinaryV2 = {
  config?: (opts?: Record<string, unknown>) => void | Record<string, unknown>;
  uploader?: {
    upload_stream?: (...args: unknown[]) => NodeJS.ReadWriteStream | undefined;
    destroy?: (publicId: string, options?: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>;
    upload?: (path: string, options?: Record<string, unknown>) => Promise<{ public_id: string; secure_url: string }>;
  };
  url?: (publicId: string, opts?: Record<string, unknown>) => string;
};

let cloudinary: CloudinaryV2 | null = null;
import streamifier from 'streamifier'
import fs from 'fs/promises'
import path from 'path'

const CLOUDINARY_URL = process.env.CLOUDINARY_URL || ''
// Consider CLOUDINARY configured only if it doesn't contain obvious placeholders
const CLOUDINARY_AVAILABLE = !!CLOUDINARY_URL && !(/[<>]|YOUR_|your_/).test(CLOUDINARY_URL)

if (CLOUDINARY_AVAILABLE) {
  // Dynamically import cloudinary so environments without it won't fail at parse-time
  // Keep the import local and narrow the resulting module safely
  (async () => {
    try {
      const mod = (await import('cloudinary')).default || (await import('cloudinary'));
      const cld = mod as unknown as { v2?: CloudinaryV2 };
      // access v2 if present
      cloudinary = cld.v2 || (cld as unknown as CloudinaryV2);
      // Call config if available (guarded)
      try {
        if (cloudinary && typeof cloudinary.config === 'function') cloudinary.config({ url: CLOUDINARY_URL });
      } catch {}
    } catch {
      // ignore import errors; cloudinary is optional
      cloudinary = null;
    }
  })();
}

export async function uploadToStorage(buffer: Buffer, filename: string) {
  if (!CLOUDINARY_AVAILABLE) {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const outPath = path.join(uploadsDir, safeName)
    await fs.writeFile(outPath, buffer)
    const url = `/uploads/${safeName}`
    console.warn('uploadToStorage: Cloudinary not configured, saved to', outPath)
    return { url, public_id: `local:${safeName}` }
  }

  return new Promise<{ url: string; public_id: string }>((resolve, reject) => {
    // Build a safe public_id from the filename (remove extension, replace unsafe chars)
    const baseName = filename.replace(/\.[^/.]+$/, '')
    // allow only alphanumeric, dash and underscore in the public id
    const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
    // Append a short timestamp to avoid accidental overwrites and collisions
    const uniquePublicId = `${safeBase}_${Date.now()}`

    const _cldUp = cloudinary as CloudinaryV2 | null
    const uploadStream = _cldUp?.uploader?.upload_stream
      ? _cldUp.uploader.upload_stream(
          { folder: 'abstain', public_id: uniquePublicId, overwrite: false, resource_type: 'image' },
          (error: unknown, result: { secure_url?: string; public_id?: string } | undefined) => {
            if (error) return reject(new Error(String(error)))
            if (!result || !result.secure_url || !result.public_id) return reject(new Error('No result from Cloudinary'))
            resolve({ url: result.secure_url, public_id: result.public_id })
          }
        )
      : undefined
    if (uploadStream) streamifier.createReadStream(buffer).pipe(uploadStream)
  })
}

export async function deleteFromStorage(publicId: string) {
  if (!publicId) return false

  if (!CLOUDINARY_AVAILABLE || publicId.startsWith('local:')) {
    try {
      const filename = publicId.replace(/^local:/, '')
      const p = path.join(process.cwd(), 'public', 'uploads', filename)
      await fs.unlink(p)
      return true
    } catch (err: unknown) {
      // If file not found, treat as success
      if (err && typeof err === 'object' && 'code' in err) {
        const asObj = err as Record<string, unknown>
        if (asObj.code === 'ENOENT') return true
      }
      console.error('deleteFromStorage local error', err)
      return false
    }
  }

    try {
      if (cloudinary && cloudinary.uploader && typeof cloudinary.uploader.destroy === 'function') {
        const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
        if (res && typeof res === 'object') {
          const r = res as Record<string, unknown>
          return r.result === 'ok' || r.result === 'not_found'
        }
      }
      return false
    } catch (e: unknown) {
      console.error('cloudinary delete error', e)
      return false
    }
}

/**
 * Build a canonical URL for an image stored in the configured storage.
 * - For local (dev) storage it maps to the saved `/uploads/<filename>` path.
 * - For Cloudinary it uses the SDK to generate a stable secure URL for the public id.
 */
export function getCanonicalUrl(publicId: string, extension = 'jpg') {
  if (!publicId) return ''

  // Local stored files use the "local:" prefix
  if (publicId.startsWith('local:')) {
    const filename = publicId.replace(/^local:/, '')
    return `/uploads/${filename}`
  }

  // If Cloudinary isn't available, attempt a reasonable fallback that matches
  // how the local dev upload path behaves (use publicId + extension).
  if (!CLOUDINARY_AVAILABLE) {
    const safe = publicId.replace(/[^a-zA-Z0-9_\/-]/g, '_')
    return `/uploads/${safe}.${extension}`
  }

  try {
    if (cloudinary && typeof cloudinary.url === 'function') {
      const url = cloudinary.url(publicId, { secure: true, format: extension })
      if (url) return url
    }
  } catch {
    // ignore and fallback to a constructed url
  }

  // Last-resort fallback: construct an https URL using the configured cloud name
  try {
    const cfg = cloudinary && typeof cloudinary.config === 'function' ? cloudinary.config() : {}
    const cloudName = cfg && typeof cfg === 'object' && 'cloud_name' in cfg ? (cfg as Record<string, unknown>).cloud_name : ''
    if (cloudName) {
      return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}.${extension}`
    }
  } catch {
    // ignore
  }

  return `/uploads/${publicId}.${extension}`
}

/**
 * Get an optimized URL for an image stored in Cloudinary.
 * This applies smart transformations to ensure consistent dimensions and quality
 * for both display and AI processing.
 * 
 * @param publicId - The Cloudinary public ID
 * @param maxWidth - Maximum width in pixels (default: 1024)
 * @param quality - Quality setting (default: 'auto:good')
 * @returns Optimized Cloudinary URL with transformations
 */
export function getOptimizedUrl(publicId: string, maxWidth = 1024, quality: 'auto:good' | 'auto:best' | '90' = 'auto:good'): string {
  if (!publicId) return ''

  // Local storage: return the local path as-is
  if (publicId.startsWith('local:')) {
    const filename = publicId.replace(/^local:/, '')
    return `/uploads/${filename}`
  }

  // If Cloudinary isn't available, fallback to canonical
  if (!CLOUDINARY_AVAILABLE) {
    return getCanonicalUrl(publicId)
  }

  try {
    // Generate Cloudinary URL with optimization transformations
    // - c_limit: Ensures the image fits within maxWidth, maintaining aspect ratio
    // - q_auto:good: Automatic quality optimization
    // - f_auto: Automatic format selection (WebP when supported)
    const _cld = cloudinary as CloudinaryV2 | null
    if (_cld && typeof _cld.url === 'function') {
      const url = _cld.url(publicId, {
        secure: true,
        transformation: [
          {
            width: maxWidth,
            crop: 'limit', // Limit size but maintain aspect ratio
            quality: quality,
            fetch_format: 'auto' // Serve WebP/AVIF when supported, fallback to original format
          }
        ]
      })
      if (url) return url
    }
  } catch (e: unknown) {
    console.error('getOptimizedUrl error', e)
    // Fallback to canonical
  }

  return getCanonicalUrl(publicId)
}

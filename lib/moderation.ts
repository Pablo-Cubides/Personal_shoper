import fetch from 'node-fetch'
import { appendLog } from './ai/logger'
import { APP_CONFIG } from './config/app.config'
import { GoogleAuth } from 'google-auth-library'

export type ModerateResult = { ok: boolean; reason?: 'multi_face' | 'minor' | 'nsfw' | 'no_face' | 'unknown' }

const BLOCK_LEVELS = new Set(['LIKELY', 'VERY_LIKELY'])
const MINOR_LABELS = new Set([
  'child',
  'kid',
  'boy',
  'girl',
  'toddler',
  'baby',
  'teen',
  'teenager',
  'youth',
  'minor',
])
const VISION_TIMEOUT_MS = Number.parseInt(process.env.GOOGLE_VISION_TIMEOUT || '8000', 10)

async function getVisionAccessToken(): Promise<string | null> {
  const serviceAccountPath = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH
  if (!serviceAccountPath) {
    await appendLog({ phase: 'moderation.auth_error', reason: 'no_service_account_path' })
    return null
  }

  try {
    const auth = new GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/cloud-vision'],
    })
    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()
    if (!accessToken.token) {
      await appendLog({ phase: 'moderation.auth_error', reason: 'no_token_from_client' })
      return null
    }
    await appendLog({ phase: 'moderation.auth_success', tokenPrefix: accessToken.token.substring(0, 10) })
    return accessToken.token
  } catch (error) {
    await appendLog({ phase: 'moderation.auth_error', error: String(error) })
    return null
  }
}

function redactUrl(imageUrl: string): string {
  return APP_CONFIG.compliance.PRIVACY_MODE ? '[redacted]' : imageUrl
}

async function basicFetchModeration(imageUrl: string, redactedUrl: string): Promise<ModerateResult> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) {
      await appendLog({ phase: 'moderation.fallback_blocked', reason: 'no_face', imageUrl: redactedUrl, status: res.status })
      return { ok: false, reason: 'no_face' }
    }
    await appendLog({ phase: 'moderation.fallback_passed', imageUrl: redactedUrl })
    return { ok: true }
  } catch (error) {
    await appendLog({ phase: 'moderation.fallback_error', imageUrl: redactedUrl, error: String(error) })
    return { ok: false, reason: 'no_face' }
  }
}

async function callVisionModeration(imageUrl: string, accessToken: string, redactedUrl: string): Promise<ModerateResult> {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate`

  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
  }
  const imageBuffer = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString('base64')

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [
          { type: 'SAFE_SEARCH_DETECTION' },
          { type: 'FACE_DETECTION', maxResults: 5 },
          { type: 'LABEL_DETECTION', maxResults: 10 },
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      await appendLog({
        phase: 'moderation.vision_http_error',
        imageUrl: redactedUrl,
        status: response.status,
        body: text,
      })
      return { ok: true, reason: 'unknown' }
    }

    const json = (await response.json()) as Record<string, unknown>
    const annotation = Array.isArray(json.responses) ? (json.responses[0] as Record<string, unknown> | undefined) : undefined

    if (!annotation || 'error' in annotation) {
      await appendLog({ phase: 'moderation.vision_response_error', imageUrl: redactedUrl, annotation })
      return { ok: true, reason: 'unknown' }
    }

    const safeSearch = (annotation.safeSearchAnnotation ?? {}) as Record<string, string>
    const hasNsfw = [safeSearch.adult, safeSearch.violence, safeSearch.racy, safeSearch.medical].some((value) =>
      value ? BLOCK_LEVELS.has(value) : false,
    )
    if (hasNsfw) {
      await appendLog({ phase: 'moderation.blocked', reason: 'nsfw', imageUrl: redactedUrl, safeSearch })
      return { ok: false, reason: 'nsfw' }
    }

    const facesRaw = annotation.faceAnnotations
    const faces = Array.isArray(facesRaw) ? (facesRaw as Array<Record<string, unknown>>) : []
    if (faces.length === 0) {
      await appendLog({ phase: 'moderation.blocked', reason: 'no_face', imageUrl: redactedUrl })
      return { ok: false, reason: 'no_face' }
    }
    if (faces.length > 1) {
      await appendLog({ phase: 'moderation.blocked', reason: 'multi_face', imageUrl: redactedUrl, count: faces.length })
      return { ok: false, reason: 'multi_face' }
    }

    const labelsRaw = annotation.labelAnnotations
    if (Array.isArray(labelsRaw)) {
      const labels = labelsRaw as Array<{ description?: string; score?: number }>
      const isMinor = labels.some((label) => {
        if (!label.description) return false
        const desc = label.description.toLowerCase()
        return MINOR_LABELS.has(desc) && (label.score ?? 0) >= 0.7
      })
      if (isMinor) {
        await appendLog({ phase: 'moderation.blocked', reason: 'minor', imageUrl: redactedUrl })
        return { ok: false, reason: 'minor' }
      }
    }

    await appendLog({ phase: 'moderation.passed', imageUrl: redactedUrl })
    return { ok: true }
  } finally {
    clearTimeout(timeout)
  }
}

export async function moderateImage(imageUrl: string): Promise<ModerateResult> {
  const redactedUrl = redactUrl(imageUrl)
  const accessToken = await getVisionAccessToken()

  if (!accessToken) {
    await appendLog({ phase: 'moderation.no_access_token', imageUrl: redactedUrl })
    return basicFetchModeration(imageUrl, redactedUrl)
  }

  try {
    const result = await callVisionModeration(imageUrl, accessToken, redactedUrl)
    return result
  } catch (error) {
    await appendLog({ phase: 'moderation.error', imageUrl: redactedUrl, error: String(error) })
    return basicFetchModeration(imageUrl, redactedUrl)
  }
}

export async function isMinorDetected() {
  return false
}

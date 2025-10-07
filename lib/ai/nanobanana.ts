import fetch from 'node-fetch'
import { uploadToStorage } from '../storage'
import { appendLog } from './logger'
import type { EditIntent } from '../types/ai'

type UnknownRecord = Record<string, unknown>

const NANOBANANA_URL = process.env.NANOBANANA_URL || ''
const NANOBANANA_KEY = process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY || ''

// Accept different environment variable names used in this project
const GEMINI_API_KEY_VAR = process.env.GEMINI_API_KEY || ''
const GEMINI_REST_URL = process.env.GEMINI_REST_URL || ''
const GOOGLE_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || process.env.GOOGLE_IMAGE_MODEL || process.env.GEMINI_MODEL || 'imagen-3.0-generate-001'

// Timeout configurations with progressive timeouts
const GENERATION_TIMEOUT = parseInt(process.env.AI_GENERATION_TIMEOUT || '120000', 10) // 120s for generation/editing

// Rate limiting configuration
const MAX_RETRIES = 3
const BASE_RETRY_DELAY = 1000 // 1 second base delay
const MAX_RETRY_DELAY = 8000 // Maximum 8 seconds delay

async function uploadIfNeeded(result: unknown, filenameBase = 'nanobanana') {
  if (!result || typeof result !== 'object') throw new Error('NanoBanana returned no result')
  const r = result as UnknownRecord
  if (typeof r.url === 'string') return { url: r.url, public_id: (r.publicId as string) || null }
  if (typeof r.base64 === 'string') {
    const buf = Buffer.from(r.base64 as string, 'base64')
    const uploaded = await uploadToStorage(buf, `${filenameBase}_${Date.now()}`)
    return { url: uploaded.url, public_id: uploaded.public_id }
  }
  throw new Error('NanoBanana returned no url or base64')
}

// Primary exported function used by API routes
export async function editWithNanoBanana(imageUrl: string, intent: EditIntent): Promise<{ editedUrl: string; note?: string; publicId?: string | null }> {
  await appendLog({ phase: 'nanobanana.start', imageUrl, intent: intent?.instruction || 'N/A' })
  
  // Helper: call a Gemini-style REST editor (expects JSON { imageUrl, intent })
  async function callGeminiEditorViaRest(url: string, apiKey: string | undefined) {
    try {
      await appendLog({ phase: 'nanobanana.request.rest', url, imageUrl, intent })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ imageUrl, intent }) })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`remote editor error ${resp.status} ${txt}`)
      }
  const data = await resp.json()
  const uploaded = await uploadIfNeeded(data, 'nanobanana')
  const maybeNote = (data as UnknownRecord).note
  const noteStr = typeof maybeNote === 'string' ? maybeNote : JSON.stringify(maybeNote ?? 'Edited via Gemini editor')
  const result = { editedUrl: uploaded.url, note: noteStr, publicId: uploaded.public_id }
      await appendLog({ phase: 'nanobanana.response.rest', request: { url, imageUrl, intent }, result })
      return result
    } catch (e: unknown) {
      await appendLog({ phase: 'nanobanana.call_error.rest', error: String(e), url })
      throw e
    }
  }

  // Helper: call Google Gemini with API Key for image editing
  async function callGoogleImageEdit(apiKey: string) {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await appendLog({ phase: 'nanobanana.request.google', imageUrl, instruction: intent?.instruction, attempt, maxRetries: MAX_RETRIES })
        
        // Try using Gemini SDK for image generation/editing
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai')
          const genAI = new GoogleGenerativeAI(apiKey)
          
          // Try Imagen model first (if available)
          const modelName = GOOGLE_IMAGE_MODEL
          await appendLog({ phase: 'nanobanana.google.sdk_attempt', model: modelName, attempt })
          
          try {
            const model = genAI.getGenerativeModel({ model: modelName })
            
            // Fetch the image and convert to base64
            const imgRes = await fetch(imageUrl)
            const imgBuffer = await imgRes.arrayBuffer()
            const base64 = Buffer.from(imgBuffer).toString('base64')
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
            
            // Create the editing prompt from intent
            const instruction = intent && intent.instruction 
              ? String(intent.instruction) 
              : (intent && intent.change ? JSON.stringify(intent.change) : 'Edit image professionally')
            
            const prompt = intent.locale === 'es'
              ? `Edita esta foto de retrato de forma profesional. ${instruction}. IMPORTANTE: Mantén la identidad y el rostro de la persona intactos. Solo modifica el estilo del cabello y la barba facial según lo solicitado. Conserva la iluminación natural y los tonos de piel. Genera un retrato editado de alta calidad.`
              : `Edit this portrait photo professionally. ${instruction}. IMPORTANT: Maintain the person's identity and face intact. Only modify hair style and facial hair (beard) as requested. Keep natural lighting and skin tones. Generate a high-quality edited portrait.`
            
            await appendLog({ phase: 'nanobanana.google.sdk_generating', model: modelName, promptLength: prompt.length, attempt })
            
            // Create AbortController for timeout management
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT)
            
            try {
              const result = await model.generateContent([
                prompt,
                {
                  inlineData: {
                    data: base64,
                    mimeType: mimeType
                  }
                }
              ])
              
              clearTimeout(timeoutId)
              
              const response = await result.response
              await appendLog({ phase: 'nanobanana.google.sdk_response', hasResponse: !!response, hasCandidates: !!response.candidates, attempt })
              
              // Try to extract image from response
              const candidates = response.candidates
              if (candidates && candidates.length > 0) {
                const parts = candidates[0].content?.parts
                if (parts && Array.isArray(parts)) {
                  for (const part of parts) {
                    if (part.inlineData && part.inlineData.data && part.inlineData.mimeType?.startsWith('image')) {
                      await appendLog({ phase: 'nanobanana.google.sdk_image_found', mimeType: part.inlineData.mimeType, attempt })
                      const uploaded = await uploadIfNeeded({ base64: part.inlineData.data }, 'nanobanana_gemini')
                      const finalResult = { 
                        editedUrl: uploaded.url, 
                        note: intent.locale === 'es' ? 'Editado con Gemini' : 'Edited with Gemini', 
                        publicId: uploaded.public_id 
                      }
                      await appendLog({ phase: 'nanobanana.response.google', result: finalResult, attempt })
                      return finalResult
                    }
                  }
                }
              }
              
              // If no image in response, log the response structure and retry
              await appendLog({ phase: 'nanobanana.google.sdk_no_image', responseText: response.text ? response.text().substring(0, 300) : 'N/A', attempt })
              
            } catch (timeoutError: unknown) {
              clearTimeout(timeoutId)
              if (controller.signal.aborted) {
                throw new Error(`Gemini generation timeout after ${GENERATION_TIMEOUT}ms`)
              }
              throw timeoutError
            }
            
          } catch (modelError: unknown) {
            const error = modelError as Error
            await appendLog({ phase: 'nanobanana.google.sdk_model_error', error: String(modelError), message: error?.message, attempt })
            
            // If the specific model doesn't work, the API might not be enabled or model doesn't support image generation
            const msg = error?.message || String(modelError) || ''
            if (msg && (
              msg.includes('not found') || 
              msg.includes('does not support') ||
              msg.includes('API has not been used')
            )) {
              await appendLog({ phase: 'nanobanana.google.api_not_enabled', note: 'Generative Language API may not be enabled or model does not support image generation', attempt })
            }
            
            lastError = error
          }
        } catch (sdkError: unknown) {
          const error = sdkError as Error
          await appendLog({ phase: 'nanobanana.google.sdk_error', error: String(sdkError), message: error?.message, attempt })
          lastError = error
        }
        
        // If we get here, the attempt failed. Calculate exponential backoff delay
        if (attempt < MAX_RETRIES) {
          const delayMs = Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY)
          await appendLog({ phase: 'nanobanana.google.retry_scheduled', attempt, maxRetries: MAX_RETRIES, delayMs, reason: 'exponential_backoff' })
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
        
      } catch (e: unknown) {
        lastError = e as Error
        await appendLog({ phase: 'nanobanana.call_error.google', error: String(e), attempt, finalAttempt: attempt === MAX_RETRIES })
        
        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          throw lastError || new Error('Gemini SDK failed after all retries')
        }
        
        // Calculate exponential backoff delay for general errors
        const delayMs = Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY)
        await appendLog({ phase: 'nanobanana.google.retry_scheduled', attempt, maxRetries: MAX_RETRIES, delayMs, reason: 'general_error_backoff' })
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Unexpected end of retry loop')
  }

  // Try in preferred order: GOOGLE_API_KEY (Gemini), GEMINI_REST_URL (custom proxy), then NANOBANANA_URL
  if (GEMINI_API_KEY_VAR) {
    try {
      return await callGoogleImageEdit(GEMINI_API_KEY_VAR)
    } catch (geminiError: unknown) {
      const error = geminiError as Error
      await appendLog({ 
        phase: 'nanobanana.google_failed', 
        error: String(geminiError).substring(0, 200),
        errorType: error?.name || 'Unknown',
        message: error?.message || 'No message'
      })
      // continue to other options
    }
  }

  if (GEMINI_REST_URL) {
    try {
      return await callGeminiEditorViaRest(GEMINI_REST_URL, undefined)
    } catch (restError: unknown) {
      const error = restError as Error
      await appendLog({ 
        phase: 'nanobanana.rest_failed', 
        error: String(restError).substring(0, 200),
        errorType: error?.name || 'Unknown',
        message: error?.message || 'No message'
      })
      // continue to other options
    }
  }

  if (NANOBANANA_URL && NANOBANANA_KEY) {
    try {
      await appendLog({ phase: 'nanobanana.request.legacy', imageUrl, intent })
      const body = { imageUrl, intent }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT)
      
      const resp = await fetch(NANOBANANA_URL, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${NANOBANANA_KEY}` 
        }, 
        body: JSON.stringify(body),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`NanoBanana error: ${resp.status} ${txt}`)
      }
  const data = await resp.json()
  const uploaded = await uploadIfNeeded(data, 'nanobanana')
  const result = { editedUrl: uploaded.url, note: 'Edited with NanoBanana', publicId: uploaded.public_id }
      await appendLog({ phase: 'nanobanana.response.legacy', request: { imageUrl, intent }, result })
      return result
    } catch (legacyError: unknown) {
      const error = legacyError as Error
      await appendLog({ 
        phase: 'nanobanana.call_error.legacy', 
        error: String(legacyError),
        errorType: error?.name || 'Unknown',
        message: error?.message || 'No message'
      })
      console.warn('NanoBanana call failed', legacyError)
      // fall through to simulated path
    }
  }

  // No local image-editing fallback is supported anymore. If all external
  // editors failed (Gemini SDK, REST editor, legacy service), return a
  // clear service-unavailable error so API route handlers can respond with
  // HTTP 503 and a user-friendly message.
  await appendLog({ 
    phase: 'nanobanana.service_unavailable', 
    imageUrl, 
    intent,
    failureReasons: {
      geminiSdk: GEMINI_API_KEY_VAR ? 'Failed after retries with exponential backoff' : 'Not configured',
      restApi: GEMINI_REST_URL ? 'Failed' : 'Not configured', 
      legacyService: (NANOBANANA_URL && NANOBANANA_KEY) ? 'Failed with timeout' : 'Not configured'
    },
    note: 'No remote image editor available (Gemini/REST/legacy all failed)' 
  })
  const err = new Error('AI image service unavailable. Please try again later.') as Error & { status?: number }
  err.status = 503
  throw err
}

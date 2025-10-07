import { NextResponse } from 'next/server'
import { moderateImage } from '../../../lib/moderation'
import { editImageWithGemini } from '../../../lib/ai/gemini-edit' // <-- CHANGED
import { applyWatermark } from '../../../lib/watermark'
import { uploadToStorage } from '../../../lib/storage'
import { trackEvent } from '../../../lib/metrics'
import { consumeCredits, getActionCost } from '../../../lib/credits'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  // Make sure to handle potential null body
  const body = await req.json().catch(() => null);
  if (!body) {
      return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 });
  }
  const { imageUrl, intent, sessionId } = body;

  // Validate required fields
  if (!imageUrl || !intent || !sessionId) {
      return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  // 1. Credit check
  const cost = getActionCost('edit');
  const creditResult = await consumeCredits(sessionId, cost);

  if (!creditResult.ok) {
    return NextResponse.json({ error: 'insufficient_credits', remaining: creditResult.remaining }, { status: 402 });
  }

  // 2. Moderation
  const mod = await moderateImage(imageUrl)
  if (!mod.ok) {
    return NextResponse.json({ error: 'moderation_blocked', reason: mod.reason }, { status: 403 })
  }

  // 3. AI Edit with Gemini <-- CHANGED
  const { editedImageBuffer, note } = await editImageWithGemini(imageUrl, intent);

  if (!editedImageBuffer) {
      // If the edit failed, we should not proceed.
      // In a real app, we might want to refund the credit here.
      return NextResponse.json({ error: 'edit_failed', note: note }, { status: 500 });
  }

  // 4. Watermark & Storage
  const withMark = await applyWatermark(editedImageBuffer) // Use the buffer directly
  const filename = `edited_${Date.now()}`
  const uploaded = await uploadToStorage(withMark, filename)

  // 5. Register generated image (This should be refactored to a DB)
  try {
    const registryPath = path.join(process.cwd(), 'data', 'generated_images.json')
    const txt = await fs.readFile(registryPath, 'utf8').catch(() => '[]')
    const arr = JSON.parse(txt || '[]')
    arr.push({ publicId: uploaded.public_id, url: uploaded.url, createdAt: Date.now() })
    await fs.writeFile(registryPath, JSON.stringify(arr, null, 2), 'utf8')
  } catch (e) {
    console.error('register-generated-image error', e)
  }

  // 6. Track event and respond
  trackEvent('edit.done', { sessionId, source: imageUrl, output: uploaded.url })
  return NextResponse.json({
    editedUrl: uploaded.url,
    note: note, // Use the note from Gemini
    publicId: uploaded.public_id,
    credits: creditResult.remaining
  })
}

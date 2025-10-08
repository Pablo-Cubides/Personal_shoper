import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    geminiApiKeyPresent: !!process.env.GEMINI_API_KEY,
    geminiRestUrlPresent: !!process.env.GEMINI_REST_URL,
    nanobananaUrlPresent: !!process.env.NANOBANANA_URL,
    nanobananaKeyPresent: !!(process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY),
    googleVisionServiceAccountPathPresent: !!process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH,
  })
}

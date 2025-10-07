import { NextResponse } from 'next/server';
import { uploadToStorage, getCanonicalUrl, getOptimizedUrl } from '../../../lib/storage';
import { appendLog } from '../../../lib/ai/logger';

// Security and configuration constants from environment variables
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10);
const MAX_SIZE_IN_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');

export async function POST(req: Request) {
  try {
    await appendLog({ phase: 'api.upload.received', timestamp: Date.now() });
    const form = await req.formData();
    const file = (form.get('file') as File | null) || (form.get('image') as File | null);

    // 1. Check if file exists
    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // 2. Validate file size
    if (file.size > MAX_SIZE_IN_BYTES) {
      await appendLog({ phase: 'api.upload.error', error: 'File too large' });
      return NextResponse.json(
        { error: `File is too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.` },
        { status: 413 } // 413 Payload Too Large
      );
    }

    // 3. Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      await appendLog({ phase: 'api.upload.error', error: `Unsupported file type: ${file.type}` });
      return NextResponse.json(
        { error: `Unsupported file type. Allowed types are: ${ALLOWED_IMAGE_TYPES.join(', ')}` },
        { status: 415 } // 415 Unsupported Media Type
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 4. Generate a safe, unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `upload_${uniqueSuffix}.${fileExtension}`;

  const res = await uploadToStorage(buffer, filename);
  const canonical = getCanonicalUrl(res.public_id)
  const optimized = getOptimizedUrl(res.public_id, 1024, 'auto:good')
  await appendLog({ phase: 'api.upload.result', imageUrl: res.url, publicId: res.public_id, canonicalUrl: canonical, optimizedUrl: optimized });
  return NextResponse.json({ 
    imageUrl: optimized,  // Use optimized URL as the main image URL
    originalUrl: res.url,  // Keep original for reference
    canonicalUrl: canonical,
    optimizedUrl: optimized,
    sessionId: `sess_${Date.now()}`, 
    publicId: res.public_id 
  });

  } catch (e: unknown) {
    const errorMessage = (e instanceof Error) ? e.message : String(e);
    console.error('upload route error', errorMessage);
    await appendLog({ phase: 'api.upload.error', error: errorMessage });
    
    // 5. Return a generic error message to the client
    return NextResponse.json(
      { error: 'An unexpected error occurred during file upload.' },
      { status: 500 }
    );
  }
}
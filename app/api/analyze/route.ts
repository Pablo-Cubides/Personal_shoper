import { NextResponse } from 'next/server';
import { analyzeImageWithGemini } from '../../../lib/ai/gemini';
import { appendLog } from '../../../lib/ai/logger';
import { enforceRateLimit, getRequestIdentifier } from '../../../lib/rate-limit';
import { enforceCredits, consumeCredits, getActionCost } from '../../../lib/credits';
import { validateImageUrl } from '../../../lib/validation/image';
import { getCached, setCached, generateAnalysisCacheKey } from '../../../lib/cache';
import { getImageBuffer, calculateImageHash } from '../../../lib/validation/image';
import { extractErrorInfo } from '../../../lib/errors';
import { APP_CONFIG } from '../../../lib/config/app.config';

export async function POST(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const { imageUrl, locale, sessionId } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'MISSING_IMAGE_URL', message: 'imageUrl is required' },
        { status: 400 }
      );
    }

    const effectiveLocale = locale || 'es';
    const effectiveSessionId = sessionId || getRequestIdentifier(req);

    await appendLog({
      phase: 'api.analyze.received',
      imageUrl: APP_CONFIG.compliance.PRIVACY_MODE ? '[redacted]' : imageUrl,
      locale: effectiveLocale,
      sessionId: effectiveSessionId,
      timestamp: Date.now(),
    });

    // 1. Rate limiting
    await enforceRateLimit(effectiveSessionId);

    // 2. Validate image
    const validation = await validateImageUrl(imageUrl);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'INVALID_IMAGE',
          message: validation.error,
          details: validation.details,
        },
        { status: 400 }
      );
    }

    // 3. Check cache
    const imageBuffer = await getImageBuffer(imageUrl);
    const imageHash = calculateImageHash(imageBuffer);
    const cacheKey = generateAnalysisCacheKey(imageHash, effectiveLocale);
    
    const cached = await getCached(cacheKey);
    if (cached) {
      await appendLog({
        phase: 'api.analyze.cache_hit',
        imageHash: imageHash.substring(0, 16),
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        analysis: cached,
        workingUrl: imageUrl,
        cached: true,
      });
    }

    // 4. Check credits (but don't consume yet - only on success)
    await enforceCredits(effectiveSessionId, 'analyze');

    // 5. Perform analysis
    const analysis = await analyzeImageWithGemini(imageUrl, effectiveLocale);

    // 6. Consume credits on success
    const cost = getActionCost('analyze');
    if (cost > 0) {
      await consumeCredits(effectiveSessionId, cost, 'analyze');
    }

    // 7. Cache the result
    await setCached(cacheKey, analysis);

    // 8. Log success
    await appendLog({
      phase: 'api.analyze.result',
      imageUrl: APP_CONFIG.compliance.PRIVACY_MODE ? '[redacted]' : imageUrl,
      success: true,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      analysis,
      workingUrl: imageUrl,
      cached: false,
    });

  } catch (error: unknown) {
    // Extract error information
    const errorInfo = extractErrorInfo(error);

    // Log error
    await appendLog({
      phase: 'api.analyze.error',
      error: errorInfo.message,
      code: errorInfo.code,
      statusCode: errorInfo.statusCode,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    });

    // Return error response
    return NextResponse.json(
      {
        error: errorInfo.code,
        message: errorInfo.message,
        ...errorInfo.details,
      },
      { status: errorInfo.statusCode }
    );
  }
}

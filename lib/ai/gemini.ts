/// <reference types="node" />
import { appendLog } from './logger';
import { getDefaultLocale } from '../config';
import type { EditIntent, BodyAnalysis, RecommendedItem } from '../types/ai';
import fetch from 'node-fetch';

// Safe environment accessor: some editors/TS servers may not have Node types enabled.
function getEnv(name: string): string | undefined {
  // Use globalThis to avoid direct 'process' symbol in environments that don't expose it
  const p = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env ? p.env[name] : undefined;
}

// Timeout configurations
const ANALYSIS_TIMEOUT = parseInt(getEnv('AI_ANALYSIS_TIMEOUT') || '60000', 10); // 60s for analysis

// Optional NLP import for enhanced text processing
// Keep as unknown; we only access it through guarded calls
let nlp: unknown = null;
// Try to dynamically import the optional 'compromise' NLP lib. This is async but we don't need to await it.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
import('compromise')
  .then((mod) => {
    // cast to unknown shape and pick default if present
    const maybe = mod as unknown as { default?: unknown };
    nlp = maybe.default ?? mod;
  })
  .catch(() => {
    // ignore if not available
  });

// Define the structure of the JSON response we expect from Gemini
type GeminiAnalysisRaw = {
  bodyOk?: boolean;
  pose?: string;
  lighting?: string;
  bodyType?: string;
  proportions?: { shoulders?: string; waist?: string; hips?: string };
  clothing?: { top?: string; bottom?: string; outer?: string; fit?: string; colors?: string[] };
  skinTone?: string;
  recommended?: RecommendedItem[] | unknown;
  suggestedActionText?: string;
  advisoryText?: string;
};

function getAnalysisPrompt(locale: 'es' | 'en'): string {
  if (locale === 'es') {
    return `Analiza esta imagen de una persona y responde SOLO con JSON v\u00e1lido. Eval\u00faa:
- bodyOk: true si la foto muestra el cuerpo completo de una sola persona adulta y es apta para análisis de vestimenta
- pose: "frontal" | "side" | "partial" | "incomplete"
- bodyType: forma corporal (ej. rectangle, inverted_triangle, hourglass, triangle)
- proportions: objeto con shoulders/waist/hips en descripci\u00f3n cualitativa
- clothing: describir prendas detectadas (top, bottom, outer), fit y colores
- skinTone: descripci\u00f3n del tono de piel y subtono
- lighting: "buena"|"regular"|"pobre"
- recommended: lista de recomendaciones estructuradas (category, recommendation, colors, reason)
- suggestedActionText: recomendaci\u00f3n corta en espa\u00f1ol
- advisoryText: p\u00e1rrafo detallado con razones profesionales

IMPORTANTE: Responde SOLO con JSON, sin texto adicional.`;
  } else {
    return `Analyze this image of a person and respond ONLY with valid JSON. Evaluate:
- bodyOk: true if the photo shows a full-body of a single adult person and is suitable for clothing analysis
- pose: "frontal" | "side" | "partial" | "incomplete"
- bodyType: body shape classification (e.g. rectangle, inverted_triangle, hourglass, triangle)
- proportions: object with shoulders/waist/hips qualitative descriptors
- clothing: describe detected garments (top, bottom, outer), fit and colors
- skinTone: description of skin tone and undertone
- lighting: "good"|"fair"|"poor"
- recommended: array of structured recommendations (category, recommendation, colors, reason)
- suggestedActionText: short recommendation in English
- advisoryText: detailed professional paragraph explaining recommendations

IMPORTANT: Respond ONLY with JSON, no additional text.`;
  }
}

export async function analyzeImageWithGemini(
  imageUrl: string,
  locale: 'es' | 'en' = getDefaultLocale()
): Promise<BodyAnalysis> {
  await appendLog({ phase: 'gemini.analyze.start', imageUrl, locale });

  const googleKey = getEnv('GEMINI_API_KEY') || '';

  if (googleKey) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(googleKey);

      // Configure the model to return JSON
      const model = genAI.getGenerativeModel({
  model: getEnv('GEMINI_MODEL') || 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      await appendLog({ phase: 'gemini.analyze.fetching_image', imageUrl });

      // Fetch the image and convert to base64
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      // Load the prompt from the external file
      const prompt = getAnalysisPrompt(locale);

      await appendLog({
        phase: 'gemini.analyze.calling_sdk',
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      });

      // Create AbortController for timeout management
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ]);

        clearTimeout(timeoutId);

        const response = await result.response;
        const text = response.text();
        await appendLog({ phase: 'gemini.analyze.response', rawText: text.substring(0, 500) });

        // Parse the JSON response (no cleaning needed anymore)
        const parsed = JSON.parse(text) as GeminiAnalysisRaw;
        await appendLog({ phase: 'gemini.analyze.parsed', analysis: parsed });

        // Build BodyAnalysis from parsed response, falling back to legacy face fields where needed
  const advisoryText = parsed.advisoryText || parsed.suggestedActionText || '';

        const recommended: RecommendedItem[] | undefined = Array.isArray(parsed.recommended)
          ? (parsed.recommended as RecommendedItem[])
          : undefined;

        const bodyAnalysis: BodyAnalysis = {
          bodyOk: parsed.bodyOk ?? true,
          pose: (parsed.pose === 'side' ? 'side' : parsed.pose === 'partial' ? 'partial' : parsed.pose === 'incomplete' ? 'incomplete' : 'frontal') as BodyAnalysis['pose'],
          bodyType: parsed.bodyType,
          proportions: parsed.proportions,
          heightHint: undefined,
          clothing: parsed.clothing,
          skinTone: parsed.skinTone,
          accessories: {},
          lighting: (parsed.lighting === 'buena' ? 'good' : parsed.lighting === 'regular' ? 'fair' : parsed.lighting === 'pobre' ? 'poor' : 'good'),
          suggestedText: parsed.suggestedActionText || parsed.suggestedActionText || advisoryText || '',
          advisoryText: advisoryText || undefined,
          recommended: recommended,
        };

        return bodyAnalysis;
      } catch (timeoutError: unknown) {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) {
          throw new Error(`Gemini analysis timeout after ${ANALYSIS_TIMEOUT}ms`);
        }
        throw timeoutError;
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        await appendLog({ phase: 'gemini.analyze.error', error: e.message, stack: e.stack });
      } else {
        await appendLog({ phase: 'gemini.analyze.error', error: String(e) });
      }
      // If Gemini fails, return a basic fallback response
      return {
        bodyOk: false,
        pose: 'frontal',
        bodyType: undefined,
        proportions: undefined,
        heightHint: undefined,
        clothing: undefined,
        skinTone: undefined,
        accessories: {},
        lighting: 'good',
        suggestedText:
          locale === 'es'
            ? 'No se pudo analizar la imagen. Por favor, intenta con otra foto.'
            : 'Could not analyze image. Please try with another photo.',
        advisoryText:
          locale === 'es'
            ? 'Asegúrate de subir una foto clara de cuerpo entero con buena iluminación.'
            : 'Make sure to upload a clear full-body photo with good lighting.',
        recommended: undefined,
      };
    }
  }

  // Fallback: Return a basic response if Gemini SDK is not available
  await appendLog({ phase: 'gemini.fallback', message: 'Returning fallback response' });
  return {
    bodyOk: false,
    pose: 'frontal',
    bodyType: undefined,
    proportions: undefined,
    heightHint: undefined,
    clothing: undefined,
    skinTone: undefined,
    accessories: {},
    lighting: 'good',
    suggestedText:
      locale === 'es'
        ? 'Sugerir outfit: chaqueta estructurada, camisa neutra y pantalón recto.'
        : 'Suggest outfit: structured jacket, neutral shirt, straight trousers.',
    advisoryText:
      locale === 'es'
        ? 'No se pudo completar el análisis. Por favor, verifica la configuración.'
        : 'Could not complete analysis. Please check configuration.',
    recommended: undefined,
  };
}

export function mapUserTextToIntent(userText: string, locale: 'es'|'en' = 'es'): EditIntent {
  const text = userText.toLowerCase();
  const changes: Array<{ type: string; value: string }> = [];

  // Try to use lightweight NLP for color extraction when available (best-effort)
  if (nlp && typeof nlp === 'function') {
    try {
      const fn = nlp as unknown as (input: string) => unknown;
      const doc = fn(userText);
      let colors: string | null = null;
      if (doc && typeof doc === 'object') {
        const d = doc as Record<string, unknown>;
        const match = d['match'];
        if (typeof match === 'function') {
          const matchFn = match as unknown as (pat?: string) => unknown;
          const maybeMatch = matchFn.call(d, '#Color+');
          if (maybeMatch && typeof maybeMatch === 'object') {
            const mm = maybeMatch as Record<string, unknown>;
            const out = mm['out'];
            if (typeof out === 'function') {
              const outFn = out as unknown as (fmt?: string) => unknown;
              const outVal = outFn.call(mm, 'text');
              if (typeof outVal === 'string' || Array.isArray(outVal)) colors = String(outVal);
            }
          }
        }
      }
      if (colors && colors.length) {
        changes.push({ type: 'clothing_color', value: String(colors) });
      }
    } catch {
      // ignore NLP failures
    }
  }

  // Keyword lists (clothing-focused only)
  const clothingKeywords = ['chaqueta','jacket','blazer','pantal','trousers','jeans','camisa','shirt','top','outfit','abrigo'];

  const hasClothing = clothingKeywords.some(k => text.includes(k));

  // Map to clothing intents (default behavior)
  if (hasClothing || true) {  // Always prioritize clothing
    if (text.includes('chaqueta') || text.includes('jacket') || text.includes('blazer')) {
      changes.push({ type: 'clothing_item', value: 'outer: structured jacket' });
      changes.push({ type: 'clothing_fit', value: 'structured' });
    }
    if (text.includes('pantal') || text.includes('trousers') || text.includes('jeans')) {
      changes.push({ type: 'clothing_item', value: 'bottom: straight trousers' });
      changes.push({ type: 'clothing_fit', value: 'regular' });
    }
    if (text.includes('camisa') || text.includes('shirt') || text.includes('top')) {
      changes.push({ type: 'clothing_item', value: 'top: neutral shirt' });
    }

    // color hints from plain text
    const colorMatch = text.match(/negro|negra|black|blanco|white|gris|gray|azul|blue|rojo|red|verde|green|beige|marr[oó]n|brown/);
    if (colorMatch) {
      changes.push({ type: 'clothing_color', value: colorMatch[0] });
    }

    // If it's a comprehensive recommendation text (from LLM), apply outfit defaults
    if (text.includes('recomendaciones') || text.includes('recommendations') || text.includes('outfit')) {
      if (!changes.some(c => c.type === 'clothing_item')) changes.push({ type: 'clothing_item', value: 'outer: structured jacket' });
      if (!changes.some(c => c.type === 'clothing_item')) changes.push({ type: 'clothing_item', value: 'bottom: straight trousers' });
      if (!changes.some(c => c.type === 'clothing_item')) changes.push({ type: 'clothing_item', value: 'top: neutral shirt' });
    }

    // Fallback: suggest a simple outfit if nothing detected
    if (changes.length === 0) {
      changes.push({ type: 'clothing_item', value: 'top: neutral shirt' });
      changes.push({ type: 'clothing_item', value: 'bottom: straight trousers' });
    }

    return {
      locale,
      change: changes,
      instruction: userText,
      preserveIdentity: true,
      outputSize: 1024,
      watermark: true,
    };
  }

  // If nothing matched above, default to clothing suggestion
  changes.push({ type: 'clothing_item', value: 'top: neutral shirt' });
  changes.push({ type: 'clothing_item', value: 'bottom: straight trousers' });
  return {
    locale,
    change: changes,
    instruction: userText,
    preserveIdentity: true,
    outputSize: 1024,
    watermark: true,
  };
}
// END OF FILE - Everything below this was Vision API legacy code and has been removed

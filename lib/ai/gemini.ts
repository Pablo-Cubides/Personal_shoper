/// <reference types="node" />
import { appendLog } from './logger';
import { getAiConfig, getDefaultLocale } from '../config';
import type { FaceAnalysis, EditIntent } from '../types/ai';
import fetch from 'node-fetch';

// Small local utility type to avoid spreading `any` — used for dynamic SDK and API shapes
type UnknownRecord = Record<string, unknown>;

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
  faceOk?: boolean;
  pose?: string;
  hair?: {
    length?: string;
    color?: string;
    density?: string;
  };
  beard?: {
    present?: boolean;
    style?: string;
    density?: string;
  };
  lighting?: string;
  suggestedActionText?: string;
  haircutRecommendation?: string;
  beardRecommendation?: string;
};

function getAnalysisPrompt(locale: 'es' | 'en'): string {
  if (locale === 'es') {
    return `Analiza esta imagen de una persona y responde SOLO con JSON válido. Evalúa:
- faceOk: true si hay una cara frontal clara de una sola persona adulta
- pose: "frontal" o "ladeado"
- hair: {length: "corto"|"medio"|"largo", color: descripción, density: "baja"|"media"|"alta"}
- beard: {present: boolean, style: descripción si existe, density: "baja"|"media"|"alta"}
- lighting: "buena"|"regular"|"pobre"
- suggestedActionText: recomendación corta en español
- haircutRecommendation: párrafo detallado sobre corte de cabello
- beardRecommendation: párrafo detallado sobre barba

IMPORTANTE: Responde SOLO con JSON, sin texto adicional.`;
  } else {
    return `Analyze this image of a person and respond ONLY with valid JSON. Evaluate:
- faceOk: true if there's a clear frontal face of one adult person
- pose: "frontal" or "side"
- hair: {length: "short"|"medium"|"long", color: description, density: "low"|"medium"|"high"}
- beard: {present: boolean, style: description if exists, density: "low"|"medium"|"high"}
- lighting: "good"|"fair"|"poor"
- suggestedActionText: short recommendation in English
- haircutRecommendation: detailed paragraph about haircut
- beardRecommendation: detailed paragraph about beard

IMPORTANT: Respond ONLY with JSON, no additional text.`;
  }
}

export async function analyzeImageWithGemini(
  imageUrl: string,
  locale: 'es' | 'en' = getDefaultLocale()
): Promise<FaceAnalysis> {
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

        // Combine recommendations into a single advisory text (max 2 paragraphs)
        const advisoryText = [parsed.haircutRecommendation, parsed.beardRecommendation]
          .filter(Boolean)
          .join('\n\n');

        // Normalize hair and beard data to match the FaceAnalysis type
        const hairFinal = {
          length: parsed.hair?.length === 'corto' ? 'short' : parsed.hair?.length === 'medio' ? 'medium' : 'long',
          color: parsed.hair?.color || 'castaño',
          density: parsed.hair?.density === 'baja' ? 'low' : parsed.hair?.density === 'media' ? 'medium' : 'high',
        };

        const beardFinal = {
          present: parsed.beard?.present ?? false,
          style: parsed.beard?.style,
          density: parsed.beard?.density === 'baja' ? 'low' : parsed.beard?.density === 'media' ? 'medium' : 'high',
        };

        // Return the structured analysis, mapping new fields to existing ones
        return {
          faceOk: parsed.faceOk ?? true,
          pose: (parsed.pose || 'frontal') as 'frontal' | 'ladeado' | 'incompleto',
          hair: hairFinal as FaceAnalysis['hair'],
          beard: beardFinal as FaceAnalysis['beard'],
          accessories: {}, // Accessories not in the new prompt, default to empty
          lighting: (parsed.lighting === 'buena' ? 'good' : parsed.lighting === 'regular' ? 'fair' : parsed.lighting === 'pobre' ? 'poor' : 'good') as 'good' | 'fair' | 'poor',
          suggestedText: parsed.suggestedActionText || advisoryText,
          advisoryText: advisoryText,
        };
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
      // The fallback logic below will be triggered if the above block fails
    }
  }

  // Fallback: Legacy Vision API for basic face detection
  let visionInfo: unknown = null;
  if (googleKey) {
    try {
  const vUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleKey}`;
      const body = {
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [
              { type: 'FACE_DETECTION', maxResults: 5 },
              { type: 'SAFE_SEARCH_DETECTION' },
              { type: 'IMAGE_PROPERTIES' },
            ],
          },
        ],
      };
      const r = await fetch(vUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
      const vis = await r.json();
      visionInfo = vis;
      await appendLog({ phase: 'vision.response', imageUrl, visionInfo: vis });
    } catch (e: unknown) {
      await appendLog({ phase: 'vision.error', imageUrl, error: String(e) });
      visionInfo = null;
    }
  }

  // Build initial structured analysis from visionInfo if present
  const analysis: FaceAnalysis = {
    faceOk: true,
    pose: 'frontal',
    hair: { length: 'medium', color: 'castaño', density: 'medium' },
    beard: { present: false, style: undefined, density: 'low' },
    accessories: {},
    lighting: 'good',
    suggestedText:
      locale === 'es'
        ? 'Prueba una barba stubble para más definición.'
        : 'Try a stubble beard for more definition.',
    advisoryText: '',
  };

  try {
    if (visionInfo && typeof visionInfo === 'object') {
      const vi = visionInfo as UnknownRecord;
      const responsesRaw = vi.responses;
      if (responsesRaw && Array.isArray(responsesRaw) && responsesRaw[0]) {
        const res = responsesRaw[0] as UnknownRecord;
        // The vision API response shape is dynamic; treat as an unknown record and access with guards.
        const resAny = res as UnknownRecord;
        // safe search
        const safe = (resAny.safeSearchAnnotation as UnknownRecord) ?? ({} as UnknownRecord);
        const safeAdult = typeof safe['adult'] === 'string' ? (safe['adult'] as string) : undefined;
        if (
          safeAdult === 'LIKELY' ||
          safeAdult === 'VERY_LIKELY' ||
          safeAdult === 'POSSIBLE'
        ) {
        return {
          ...analysis,
          faceOk: false,
          advisoryText:
            locale === 'es'
              ? 'Imagen bloqueada por contenido no apropiado.'
              : 'Blocked for inappropriate content.',
        };
      }
        // faces
        const facesRaw = resAny.faceAnnotations;
        const faces = Array.isArray(facesRaw) ? (facesRaw as unknown[]) : [];
        if (faces.length === 0)
        return {
          ...analysis,
          faceOk: false,
          advisoryText:
            locale === 'es'
              ? 'No se detectó una cara frontal clara.'
              : 'No clear face detected.',
        };
        if (faces.length > 1)
        return {
          ...analysis,
          faceOk: false,
          advisoryText:
            locale === 'es'
              ? 'Se detectaron varias personas en la imagen.'
              : 'Multiple people detected.',
        };
        const f = faces[0] as UnknownRecord | undefined;
        // heuristics for pose — read numeric fields defensively via helper
        const readNum = (obj: UnknownRecord | undefined, ...keys: string[]) => {
          if (!obj) return 0;
          for (const k of keys) {
            const v = obj[k];
            if (typeof v === 'number') return v;
          }
          return 0;
        };
        const yaw = readNum(f, 'panAngle', 'yaw');
        const roll = readNum(f, 'rollAngle', 'roll');
      analysis.pose = Math.abs(yaw) < 15 && Math.abs(roll) < 12 ? 'frontal' : 'ladeado';
      analysis.faceOk = true;

        // image properties: approximate dominant color -> hair color heuristic (best effort)
        const props = resAny.imagePropertiesAnnotation as UnknownRecord | undefined;
        const dominantColors = props?.dominantColors as UnknownRecord | undefined;
        if (dominantColors && Array.isArray(dominantColors.colors) && dominantColors.colors.length) {
          const dc = (dominantColors.colors[0] as UnknownRecord)?.color as UnknownRecord | undefined;
          if (dc) {
            // simple mapping
            const r = typeof dc.red === 'number' ? dc.red : 0;
            const g = typeof dc.green === 'number' ? dc.green : 0;
            const b = typeof dc.blue === 'number' ? dc.blue : 0;
            if (r > 150 && g < 110 && b < 110) analysis.hair.color = 'rojo/rojizo';
            else if (r > 140 && g > 120 && b < 100) analysis.hair.color = 'rubio';
            else if (r < 80 && g < 80 && b < 80) analysis.hair.color = 'negro/oscuro';
            else analysis.hair.color = 'castaño';
          }
        }

      // rough beard presence from landmarks (mouth/chin) -> crude heuristic
      if (f && typeof f === 'object' && 'landmarking' in (f as UnknownRecord)) {
        // ignore; keep default
      }

      // advisory base text
      analysis.advisoryText =
        locale === 'es'
          ? 'Análisis automático: la imagen parece adecuada. Recomendamos un corte medio con laterales más cortos y barba tipo stubble para enfatizar la mandíbula. Evita accesorios voluminosos.'
          : 'Automatic analysis: image looks OK. We recommend a medium cut with shorter sides and a stubble beard to emphasize the jawline. Avoid bulky accessories.';
      }
    }
    
  } catch (e: unknown) {
    await appendLog({ phase: 'analysis.error', error: String(e) });
  }

  // If a Gemini REST endpoint is configured, send a full prompt + vision summary to it for a richer advisory
  const cfg = getAiConfig();
  const geminiEndpoint =
    (cfg && cfg.gemini_rest_url) || getEnv('GEMINI_REST_URL') || '';
  if (geminiEndpoint) {
    const prompt = `Evalúa la imagen y responde JSON estructurado. Verifica: frontalidad, una sola persona, sin menores ni desnudos. Si OK, describe forma de cara, corte recomendado, estilo y densidad de barba, accesorios y una recomendación profesional en ${locale}. Incluye campos: advisoryText, cut, beard, accessories, confidence.`;
    const payload = { imageUrl, prompt, visionSummary: visionInfo };
    try {
      await appendLog({ phase: 'gemini.call', payload: { imageUrl, prompt } });
      const r = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      await appendLog({ phase: 'gemini.response', json });
      // expect json to include the advisory fields; merge best-effort
      if (json && json.advisoryText) analysis.advisoryText = json.advisoryText;
      if (json && json.cut)
        analysis.hair.length = json.cut.length || analysis.hair.length;
      if (json && json.beard) analysis.beard = json.beard;
      if (json && json.accessories) analysis.accessories = json.accessories;
      return analysis;
    } catch (e: unknown) {
      await appendLog({ phase: 'gemini.call.error', error: String(e) });
    }
  }

  // default fallback - Generate professional advisory
  try {
    if (!analysis.advisoryText || analysis.advisoryText.length === 0) {
      if (locale === 'es') {
        analysis.advisoryText =
          '¡Perfecto! He analizado tu foto.\n\n' +
          'RECOMENDACIONES:\n' +
          'Para el cabello, te recomiendo un corte medio con laterales degradados (fade) para un look moderno.\n' +
          'Para la barba, una barba tipo stubble (de 2-3mm) definiría mejor tu mandíbula.';
        analysis.suggestedText = 'Aplicar corte con fade y barba stubble.';
      } else {
        // English version
        analysis.advisoryText =
          'Perfect! I\'ve analyzed your photo.\n\n' +
          'RECOMMENDATIONS:\n' +
          'For your hair, I recommend a medium cut with faded sides for a modern look.\n' +
          'For your beard, a stubble beard (2-3mm) would better define your jawline.';
        analysis.suggestedText = 'Apply fade cut with stubble beard.';
      }
    }
  } catch (e: unknown) {
    await appendLog({ phase: 'fallback.error', error: String(e) });
  }

  return analysis;
}

export function mapUserTextToIntent(userText: string, locale: 'es'|'en' = 'es'): EditIntent {
  const text = userText.toLowerCase()
  const changes: Array<{ type: string; value: string }> = []
  
  // Try to use lightweight NLP for better extraction when available
  if (nlp && typeof nlp === 'function') {
    try {
      // call the dynamic lib in a guarded way
      const fn = nlp as unknown as (input: string) => unknown;
      const doc = fn(userText);

      // best-effort access: many compromise methods return objects; access methods defensively
      let colors: string | null = null;
      if (doc && typeof doc === 'object') {
        const d = doc as Record<string, unknown>;
        const match = d['match'];
        if (typeof match === 'function') {
          // call match on the doc object, using a safer function signature
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
        changes.push({ type: 'hair_color', value: String(colors) });
      }
    } catch {
      // NLP failed, continue with basic processing
    }
  }
  
  // Hair length detection
  if (text.includes('corto') || text.includes('short')) {
    changes.push({ type: 'hair_length', value: 'short' })
  } else if (text.includes('largo') || text.includes('long')) {
    changes.push({ type: 'hair_length', value: 'long' })
  } else if (text.includes('medio') || text.includes('medium')) {
    changes.push({ type: 'hair_length', value: 'medium' })
  }
  
  // Beard style detection
  if (text.includes('stubble') || text.includes('stubble')) {
    changes.push({ type: 'beard_style', value: 'stubble' })
  } else if (text.includes('barba completa') || text.includes('full beard')) {
    changes.push({ type: 'beard_style', value: 'full' })
  }
  
  // Hair color detection
  const colorMatch = text.match(/casta[nñ]o|brown|negro|black|rubio|blond|pelirrojo|red/)
  if (colorMatch) {
    changes.push({ type: 'hair_color', value: colorMatch[0] })
  }
  
  // Hair style detection
  if (text.includes('fade') || text.includes('degradado')) {
    changes.push({ type: 'hair_style', value: 'fade' })
  }
  
  // If it's a comprehensive recommendation text (from LLM), extract key changes
  if (text.includes('recomendaciones') || text.includes('recommendations') || text.includes('corte texturizado')) {
    // This is likely the initial LLM advisory - apply default transformations
    if (!changes.some(c => c.type === 'hair_style')) {
      changes.push({ type: 'hair_style', value: 'fade medio con textura' })
    }
    if (!changes.some(c => c.type === 'beard_style')) {
      changes.push({ type: 'beard_style', value: 'stubble' })
    }
  }
  
  // Fallback if no changes detected
  if (changes.length === 0) {
    changes.push({ type: 'beard_style', value: 'stubble' })
    changes.push({ type: 'hair_style', value: 'fade medio' })
  }
  
  return {
    locale,
    change: changes,
    // include the original instruction text so downstream editors can use it
    instruction: userText,
    preserveIdentity: true,
    outputSize: 1024,
    watermark: true
  }
}

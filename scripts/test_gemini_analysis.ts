/**
 * Test rápido del análisis de Gemini Vision
 * Ejecutar: npx ts-node scripts/test_gemini_analysis.ts
 */

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('\n🧪 PROBANDO ANÁLISIS DE GEMINI VISION\n');
  console.log('='.repeat(60));

  // Load environment
  try {
    dotenv.config({ path: '.env.local' });
  } catch {}

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.log('\n❌ ERROR: No se encontró GEMINI_API_KEY');
    console.log('   Configura tu API key en .env.local\n');
    process.exit(1);
  }

  console.log(`✅ API Key encontrada: ${apiKey.substring(0, 15)}...\n`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    });

    console.log('📷 Usando imagen de prueba local...\n');

    // Try to use local test image
    const testImagePath = path.join(process.cwd(), 'public', 'uploads', 'imagen_prueba_din.jpg');

    let base64Image, mimeType;

    if (fs.existsSync(testImagePath)) {
      console.log(`   ✅ Imagen local encontrada: ${testImagePath}`);
      const buffer = fs.readFileSync(testImagePath);
      base64Image = buffer.toString('base64');
      mimeType = 'image/jpeg';
    } else {
      console.log('   ⚠️  No se encontró imagen local, usando imagen de ejemplo remota');
      const testUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';
      const response = await fetch(testUrl);
      const buffer = await response.arrayBuffer();
      base64Image = Buffer.from(buffer).toString('base64');
      mimeType = 'image/jpeg';
    }

    const prompt = `Analiza esta foto de retrato y proporciona un análisis detallado profesional como barbero experto. 

IMPORTANTE: Responde SOLO con JSON válido, sin markdown ni explicaciones adicionales.

Evalúa:
1. ¿La foto es adecuada? (frontal, una sola persona, buena iluminación)
2. Forma del rostro y características
3. Estilo actual de cabello (longitud, color, textura)
4. Barba actual (si tiene o no)
5. Recomendaciones profesionales específicas para cabello y barba

Responde en este formato JSON exacto:
{
  "faceOk": true/false,
  "pose": "frontal" o "ladeado" o "incompleto",
  "hair": {
    "length": "short" o "medium" o "long",
    "color": "descripción del color",
    "density": "low" o "medium" o "high"
  },
  "beard": {
    "present": true/false,
    "style": "descripción si tiene barba",
    "density": "low" o "medium" o "high"
  },
  "lighting": "good" o "fair" o "poor",
  "advisoryText": "Análisis profesional completo en español con recomendaciones detalladas de corte, barba, y estilo. Incluye emojis y formato claro.",
  "suggestedText": "Texto corto con la recomendación principal"
}`;

    console.log('\n⏳ Enviando imagen a Gemini para análisis...\n');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    console.log('📄 Respuesta cruda de Gemini:\n');
    console.log(text.substring(0, 500));
    console.log('\n' + '='.repeat(60) + '\n');

    // Try to parse JSON
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleanText);

      console.log('✅ ANÁLISIS PARSEADO CORRECTAMENTE:\n');
      console.log('🔍 Rostro OK:', analysis.faceOk ? '✅ Sí' : '❌ No');
      console.log('📐 Pose:', analysis.pose);
      console.log('💇 Cabello:');
      console.log(`   - Longitud: ${analysis.hair.length}`);
      console.log(`   - Color: ${analysis.hair.color}`);
      console.log(`   - Densidad: ${analysis.hair.density}`);
      console.log('🧔 Barba:');
      console.log(`   - Presente: ${analysis.beard.present ? 'Sí' : 'No'}`);
      if (analysis.beard.present) {
        console.log(`   - Estilo: ${analysis.beard.style}`);
        console.log(`   - Densidad: ${analysis.beard.density}`);
      }
      console.log('💡 Iluminación:', analysis.lighting);
      console.log('\n📝 RECOMENDACIÓN PROFESIONAL:\n');
      console.log(analysis.advisoryText);
      console.log('\n✅ PRUEBA EXITOSA - Gemini Vision está funcionando correctamente\n');

    } catch {
      console.log('⚠️  No se pudo parsear como JSON, pero Gemini respondió:');
      console.log(text);
      console.log('\nNota: Ajusta el prompt si es necesario para obtener JSON válido\n');
    }

  } catch (error: unknown) {
    console.log('\n❌ ERROR AL LLAMAR A GEMINI:\n');
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`   ${msg}\n`);

    if (msg.includes('API has not been used') || msg.includes('SERVICE_DISABLED')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   La Generative Language API no está habilitada.');
      console.log('   Habilítala en:');
      console.log('   https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=870598526595');
      console.log('   \n   Después espera 1-2 minutos y vuelve a probar.\n');
    } else if (msg.includes('API key not valid')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   La API key no es válida.');
      console.log('   Verifica que copiaste correctamente la key desde:');
      console.log('   https://aistudio.google.com/app/apikey\n');
    } else {
      console.log('Stack trace completo:');
      if (error instanceof Error && error.stack) console.log(error.stack);
      else console.log(String(error));
    }

    process.exit(1);
  }

  process.exit(0);
})();

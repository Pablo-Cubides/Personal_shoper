/**
 * Lista los modelos disponibles en tu API Key de Gemini
 */

import path from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

console.log('\n📋 LISTANDO MODELOS DISPONIBLES EN TU PROYECTO\n');
console.log('='.repeat(60));

if (!apiKey) {
  console.log('❌ No se encontró GEMINI_API_KEY');
  process.exit(1);
}

console.log(`✅ API Key: ${apiKey.substring(0, 15)}...\n`);

(async () => {
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey;
    console.log('🔍 Consultando:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    console.log('');

    const response = await fetch(url);
    const text = await response.text();

    console.log('Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      console.log('❌ ERROR:');
      console.log(text);

      if (text.includes('API has not been used') || text.includes('SERVICE_DISABLED')) {
        console.log('\n💡 SOLUCIÓN:');
        console.log('   La API NO está habilitada todavía.');
        console.log('   Ve a: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
        console.log('   Y haz clic en ENABLE');
      }

      process.exit(1);
    }

    type UnknownRecord = Record<string, unknown>;

    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const p = parsed as UnknownRecord;
      const models = Array.isArray(p.models) ? (p.models as UnknownRecord[]) : [];

      if (models.length > 0) {
        console.log('✅ MODELOS DISPONIBLES:\n');

        models.forEach(model => {
          const name = typeof model.name === 'string' ? model.name : String((model as any)?.name ?? '');
          console.log(`📦 ${name}`);
          if (typeof model.displayName === 'string') console.log(`   Nombre: ${model.displayName}`);
          if (typeof model.description === 'string') console.log(`   Descripción: ${model.description.substring(0, 80)}...`);
          if (Array.isArray(model.supportedGenerationMethods)) {
            console.log(`   Métodos: ${(model.supportedGenerationMethods as string[]).join(', ')}`);
          }
          console.log('');
        });

        const flashModel = models.find(m => typeof m.name === 'string' && (m.name.includes('gemini-1.5-flash') || m.name.includes('gemini-pro')));

        if (flashModel && typeof flashModel.name === 'string') {
          console.log('✅ MODELO PARA ANÁLISIS ENCONTRADO:');
          console.log(`   ${flashModel.name}`);
          console.log('\n   Puedes usar este modelo en tu .env.local:');
          console.log(`   GEMINI_MODEL=${flashModel.name.replace('models/', '')}`);
        } else {
          console.log('⚠️  No se encontró gemini-1.5-flash');
          console.log('   Usa alguno de los modelos listados arriba');
        }

      } else {
        console.log('⚠️  No se encontraron modelos disponibles');
      }
    } else {
      console.log('⚠️  No se encontraron modelos disponibles');
    }

  } catch (error: unknown) {
    console.log('❌ ERROR:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) console.log(error.stack);
    process.exit(1);
  }
})();

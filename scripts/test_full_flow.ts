/**
 * Script de prueba completa del flujo de análisis y edición
 * Verifica: env vars → análisis Gemini → edición con Gemini SDK
 */

import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local explícitamente
const envPath = path.join(process.cwd(), '.env.local');
console.log('📁 Cargando .env.local desde:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error cargando .env.local:', result.error);
  process.exit(1);
}

console.log('\n✅ Variables de entorno cargadas\n');

// 1. Verificar variables críticas
console.log('🔍 VERIFICACIÓN DE VARIABLES DE ENTORNO:');
console.log('==========================================');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `✅ Configurada (${process.env.GEMINI_API_KEY.substring(0, 20)}...)` : '❌ NO configurada');
console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL || '(usando default)');
console.log('GOOGLE_IMAGE_MODEL:', process.env.GOOGLE_IMAGE_MODEL || '(usando default)');
console.log('GEMINI_REST_URL:', process.env.GEMINI_REST_URL || '❌ NO configurada');
console.log('NANOBANANA_URL:', process.env.NANOBANANA_URL || '❌ NO configurada');
console.log('GOOGLE_VISION_SERVICE_ACCOUNT_PATH:', process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH || '❌ NO configurada');
console.log('CLOUDINARY_URL:', process.env.CLOUDINARY_URL ? '✅ Configurada' : '❌ NO configurada');
console.log('==========================================\n');

// 2. Test de análisis con Gemini
async function testGeminiAnalysis() {
  console.log('🧪 TEST 1: Análisis con Gemini SDK');
  console.log('-----------------------------------');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ No se puede probar: GEMINI_API_KEY no está configurada');
    return false;
  }

  try {
    const { analyzeImageWithGemini } = await import('../lib/ai/gemini.js');
    
    // Usar una imagen de prueba pública
    const testImageUrl = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1200&fit=crop';
    
    console.log('📷 Analizando imagen de prueba:', testImageUrl);
    console.log('⏳ Esperando respuesta de Gemini...\n');
    
    const analysis = await analyzeImageWithGemini(testImageUrl, 'es');
    
    console.log('✅ Análisis completado:');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('\n');
    return true;
  } catch (error) {
    console.error('❌ Error en análisis:', error);
    return false;
  }
}

// 3. Test de edición con Gemini SDK
async function testGeminiEdit() {
  console.log('🧪 TEST 2: Edición con Gemini SDK (imagen generation)');
  console.log('------------------------------------------------------');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ No se puede probar: GEMINI_API_KEY no está configurada');
    return false;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const modelName = process.env.GOOGLE_IMAGE_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    console.log('📦 Usando modelo:', modelName);
    
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Imagen de prueba
    const testImageUrl = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1200&fit=crop';
    console.log('📷 Imagen de prueba:', testImageUrl);
    
    // Fetch y convertir a base64
    const imgRes = await fetch(testImageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    
    console.log('🎨 Solicitando edición: cambiar a chaqueta azul');
    console.log('⏳ Esperando respuesta de Gemini (puede tomar 30-60 segundos)...\n');
    
    const prompt = 'Edita esta foto de forma profesional. Cambia la ropa superior a una chaqueta azul elegante. IMPORTANTE: Mantén la identidad de la persona. Genera una imagen editada de alta calidad.';
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ]);
    
    const response = await result.response;
    console.log('📦 Respuesta recibida');
    
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts && Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data && part.inlineData.mimeType?.startsWith('image')) {
            console.log('✅ ¡Imagen editada generada exitosamente!');
            console.log('   Tipo:', part.inlineData.mimeType);
            console.log('   Tamaño:', Math.round(part.inlineData.data.length * 0.75 / 1024), 'KB (aprox)');
            return true;
          }
        }
      }
    }
    
    // Si no se encontró imagen, mostrar la respuesta
    console.log('⚠️  No se generó imagen. Respuesta:');
    console.log(response.text ? response.text().substring(0, 500) : JSON.stringify(response, null, 2).substring(0, 500));
    return false;
    
  } catch (error: any) {
    console.error('❌ Error en edición:', error.message || error);
    if (error.message?.includes('API has not been used')) {
      console.log('\n💡 SOLUCIÓN: Habilita la API de Generative Language en:');
      console.log('   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
    }
    return false;
  }
}

// 4. Ejecutar todos los tests
async function runAllTests() {
  console.log('\n🚀 INICIANDO PRUEBAS DEL FLUJO COMPLETO\n');
  console.log('========================================\n');
  
  const test1 = await testGeminiAnalysis();
  console.log('\n');
  
  const test2 = await testGeminiEdit();
  console.log('\n');
  
  console.log('========================================');
  console.log('📊 RESULTADOS:');
  console.log('   Análisis:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('   Edición:', test2 ? '✅ PASS' : '❌ FAIL');
  console.log('========================================\n');
  
  if (test1 && test2) {
    console.log('🎉 ¡Todas las pruebas pasaron! El flujo está funcionando correctamente.');
    process.exit(0);
  } else {
    console.log('⚠️  Algunas pruebas fallaron. Revisa los errores arriba.');
    process.exit(1);
  }
}

// Ejecutar
runAllTests().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});

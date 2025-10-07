/**
 * Script para verificar la configuración de Gemini y las APIs necesarias
 * Ejecutar: npx ts-node scripts/check_gemini_config.ts
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env.local
const dotenvPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: dotenvPath });

console.log('\n🔍 VERIFICANDO CONFIGURACIÓN DE GEMINI...\n');
console.log('='.repeat(60));
console.log(`📄 Cargando variables desde: ${dotenvPath}\n`);

const checks: { name: string; status: string; message: string }[] = [];
let allOk = true;

// 1. Check API Key
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  checks.push({ name: 'API Key de Gemini', status: '❌ FALTA', message: 'Configura GEMINI_API_KEY en .env.local' });
  allOk = false;
} else if (apiKey.includes('tu_api_key') || apiKey.length < 20) {
  checks.push({ name: 'API Key de Gemini', status: '❌ INVÁLIDA', message: 'La API key parece ser un placeholder. Obtén una real en https://aistudio.google.com/app/apikey' });
  allOk = false;
} else {
  checks.push({ name: 'API Key de Gemini', status: '✅ OK', message: `Key encontrada (${apiKey.substring(0, 15)}...)` });
}

// 2. Check Cloudinary
const cloudinary = process.env.CLOUDINARY_URL;
if (!cloudinary) {
  checks.push({ name: 'Cloudinary URL', status: '❌ FALTA', message: 'Configura CLOUDINARY_URL en .env.local' });
  allOk = false;
} else if (cloudinary.includes('tu_')) {
  checks.push({ name: 'Cloudinary URL', status: '❌ INVÁLIDA', message: 'La URL parece ser un placeholder' });
  allOk = false;
} else {
  checks.push({ name: 'Cloudinary URL', status: '✅ OK', message: 'Configurada correctamente' });
}

// 3. Check Model Configuration
const analysisModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
checks.push({ name: 'Modelo de Análisis', status: '✅ OK', message: analysisModel });

const imageModel = process.env.GOOGLE_IMAGE_MODEL || 'imagen-3.0-generate-001';
checks.push({ name: 'Modelo de Edición', status: 'ℹ️  INFO', message: imageModel });

// 4. Check Service Account (optional)
const secretsPath = path.join(process.cwd(), 'secrets');
let saFound = false;
if (fs.existsSync(secretsPath)) {
  const files = fs.readdirSync(secretsPath).filter(f => f.endsWith('.json'));
  if (files.length > 0) {
    checks.push({ name: 'Service Account', status: '✅ OK', message: `Encontrado: ${files[0]}` });
    saFound = true;
  }
}
if (!saFound) {
  checks.push({ name: 'Service Account', status: 'ℹ️  OPCIONAL', message: 'No se encontró. Usando solo API Key (OK)' });
}

// 5. Test SDK availability - skipped for linting compatibility
checks.push({ name: 'SDK de Gemini', status: '⚠️ SKIP', message: 'Verificación omitida por compatibilidad de linting' });

// Print results
console.log('');
checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
  console.log(`   ${check.message}`);
  console.log('');
});

console.log('='.repeat(60));

if (allOk) {
  console.log('\n✅ CONFIGURACIÓN CORRECTA');
  console.log('\n📝 PRÓXIMOS PASOS:');
  console.log('   1. Habilita las APIs en Google Cloud Console');
  console.log('   2. Verifica que la facturación esté habilitada');
  console.log('   3. Ejecuta: npm run dev');
  console.log('   4. Prueba subiendo una foto\n');
} else {
  console.log('\n❌ FALTAN CONFIGURACIONES');
  console.log('\n📝 ACCIONES REQUERIDAS:');
  console.log('   1. Verifica que .env.local existe y tiene las variables');
  console.log('   2. Rellena las variables faltantes');
  console.log('   3. Ejecuta este script de nuevo\n');
  process.exit(1);
}

// If API key is present, try a test call
if (apiKey && apiKey.length > 20 && !apiKey.includes('tu_api_key')) {
  console.log('\n🧪 PROBANDO CONEXIÓN CON GEMINI...\n');
  
  ;(async () => {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: analysisModel });
      
      console.log('   Enviando mensaje de prueba...');
      const result = await model.generateContent(['Hola, responde solo: OK']);
      const response = await result.response;
      const text = response.text();
      
      if (text) {
        console.log(`   ✅ Respuesta recibida: "${text.trim().substring(0, 50)}"`);
        console.log('\n✅ CONEXIÓN CON GEMINI EXITOSA');
        console.log('\n🎉 TODO ESTÁ LISTO - Ejecuta: npm run dev\n');
      } else {
        console.log('   ⚠️  Respuesta vacía, pero la conexión funciona\n');
      }
      process.exit(0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ ERROR: ${msg}`);
      
      if (msg.includes('API has not been used') || msg.includes('SERVICE_DISABLED')) {
        console.log('\n❌ LA API NO ESTÁ HABILITADA');
        console.log('\n📖 LEE EL ARCHIVO: HABILITAR_API.md');
        console.log('   Contiene instrucciones paso a paso de qué hacer.\n');
        console.log('   En resumen:');
        console.log('   1. Ve a Google Cloud Console');
        console.log('   2. Habilita "Generative Language API"');
        console.log('   3. Habilita facturación si es necesario');
        console.log('   4. Espera 1-2 minutos');
        console.log('   5. Ejecuta este script de nuevo\n');
      } else if (msg.includes('API key not valid')) {
        console.log('\n❌ LA API KEY NO ES VÁLIDA');
        console.log('\n   Verifica que copiaste la key correctamente desde:');
        console.log('   https://aistudio.google.com/app/apikey\n');
      } else if (msg.includes('not found for API version')) {
        console.log('\n❌ MODELO NO DISPONIBLE');
        console.log('\n   El modelo especificado no está disponible.');
        console.log('   Esto suele significar que la API no está habilitada.');
        console.log('\n   📖 LEE: HABILITAR_API.md para instrucciones completas\n');
      } else {
        if (error instanceof Error && error.stack) console.log('\n   Stack trace: ' + error.stack + '\n');
        else console.log('\n   Stack trace: ' + msg + '\n');
      }
      
      process.exit(1);
    }
  })();

} else {
  process.exit(0);
}


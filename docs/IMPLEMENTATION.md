# 🚀 Guía de Implementación - Fases 1-3

Esta guía cubre la implementación de las mejoras críticas (Fases 1-3) para el proyecto de análisis facial con IA.

## 📋 Índice

- [Resumen de Cambios](#resumen-de-cambios)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Sistema de Créditos](#sistema-de-créditos)
- [Pruebas](#pruebas)
- [Integración con Plataforma Principal](#integración-con-plataforma-principal)
- [Troubleshooting](#troubleshooting)

---

## ✨ Resumen de Cambios

### Fase 1: Estabilización ✅
- ✅ Sistema de configuración centralizada
- ✅ Manejo robusto de errores con clases personalizadas
- ✅ Circuit breaker y retry logic
- ✅ Rate limiting (in-memory y Redis)
- ✅ Validación completa de imágenes
- ✅ Sistema de créditos configurable
- ✅ Logging estructurado mejorado

### Fase 2: Optimización ✅
- ✅ Sistema de caché (in-memory y Redis)
- ✅ Caché de análisis por hash de imagen
- ✅ Caché de generaciones por hash + instrucción
- ✅ Timeouts configurables
- ✅ Compresión automática de respuestas

### Fase 3: Compliance ✅
- ✅ Política de privacidad (GDPR/CCPA)
- ✅ Términos de servicio
- ✅ Modo de privacidad (no logear URLs de imágenes)
- ✅ Auto-eliminación de imágenes (configurable)
- ✅ Periodo de retención configurable

---

## 📦 Instalación

### 1. Paquetes Opcionales

Algunos paquetes son opcionales dependiendo de tus necesidades:

```bash
# Obligatorios (ya deberían estar instalados)
npm install

# Opcional: Redis para caché y rate limiting distribuido
npm install @upstash/redis

# Opcional: Monitoring con Sentry
npm install @sentry/nextjs
```

### 2. Verificar Instalación

```bash
npm run build
```

---

## ⚙️ Configuración

### 1. Copiar Variables de Entorno

```bash
cp .env.example .env.local
```

### 2. Configuración Mínima (Para Pruebas)

```env
# OBLIGATORIO
GEMINI_API_KEY=tu_api_key_aqui
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# CRÉDITOS - Configuración para Pruebas
CREDIT_COST_ANALYSIS=0
CREDIT_COST_GENERATION=0
ENFORCE_CREDITS=false
STARTING_CREDITS=999

# FEATURES
RATE_LIMIT_ENABLED=true
CACHE_ENABLED=true
MODERATION_ENABLED=true
WATERMARK_ENABLED=true
```

### 3. Configuración Recomendada (Producción)

```env
# CRÉDITOS - Cuando integres con la plataforma principal
CREDIT_COST_ANALYSIS=0
CREDIT_COST_GENERATION=1
ENFORCE_CREDITS=true

# REDIS - Para múltiples instancias
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# COMPLIANCE
PRIVACY_MODE=true
DELETE_IMAGES_AFTER=true
IMAGE_RETENTION_DAYS=30

# MONITORING
MONITORING_ENABLED=true
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=warn
```

---

## 💳 Sistema de Créditos

### Configuración Actual (Pruebas)

```typescript
// lib/config/app.config.ts
credits: {
  COST_PER_ANALYSIS: 0,      // ✅ Gratis
  COST_PER_GENERATION: 0,    // ✅ Gratis
  ENFORCE_CREDITS: false,    // ✅ No verificar
  STARTING_CREDITS: 999,     // ✅ Créditos ilimitados
}
```

### Cambiar a Producción

**Opción 1: Variables de Entorno (Recomendado)**

```env
# .env.local
CREDIT_COST_ANALYSIS=0
CREDIT_COST_GENERATION=1
ENFORCE_CREDITS=true
```

**Opción 2: Código Directo**

```typescript
// lib/config/app.config.ts
credits: {
  COST_PER_ANALYSIS: 0,
  COST_PER_GENERATION: 1,  // 👈 Cambiar aquí
  ENFORCE_CREDITS: true,   // 👈 Y aquí
}
```

### Integración con Plataforma Principal

Cuando integres con tu plataforma principal que maneja créditos:

```typescript
// lib/credits.ts - Modifica estas funciones:

export async function checkCredits(sessionId: string): Promise<number> {
  // ANTES: Local storage
  // return creditStore.get(sessionId) || 0;
  
  // DESPUÉS: API de tu plataforma
  const response = await fetch(`${PLATFORM_API}/credits/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });
  const data = await response.json();
  return data.credits;
}

export async function consumeCredits(
  sessionId: string,
  cost: number,
  operation: string
): Promise<{ ok: boolean; remaining?: number }> {
  // DESPUÉS: API de tu plataforma
  const response = await fetch(`${PLATFORM_API}/credits/consume`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId, cost, operation })
  });
  return response.json();
}
```

---

## 🧪 Pruebas

### 1. Verificar Rate Limiting

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Probar rate limiting
for i in {1..15}; do curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/test.jpg"}'; done
```

**Resultado esperado:** Después de 10 requests, deberías recibir error 429.

### 2. Verificar Caché

```bash
# Primera llamada (sin caché)
time curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/test.jpg"}'

# Segunda llamada (con caché - debe ser más rápida)
time curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/test.jpg"}'
```

**Resultado esperado:** Segunda llamada < 100ms, con `"cached": true`.

### 3. Verificar Validación de Imágenes

```bash
# Imagen muy pequeña (debe fallar)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://via.placeholder.com/100"}'

# Imagen muy grande (debe fallar)
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://example.com/huge-image.jpg"}'
```

**Resultado esperado:** Error 400 con mensaje de validación.

### 4. Verificar Sistema de Créditos

```typescript
// tests/credits.test.ts
import { checkCredits, consumeCredits, getActionCost } from '../lib/credits';

describe('Credits System', () => {
  it('should cost 0 credits in testing mode', () => {
    expect(getActionCost('analyze')).toBe(0);
    expect(getActionCost('generate')).toBe(0);
  });

  it('should not enforce credits when disabled', async () => {
    const result = await consumeCredits('test-session', 999, 'test');
    expect(result.ok).toBe(true);
  });
});
```

Ejecutar:

```bash
npm test
```

### 5. Verificar Circuit Breaker

```typescript
// tests/resilience.test.ts
import { getCircuitBreaker } from '../lib/resilience';

describe('Circuit Breaker', () => {
  it('should open after threshold failures', async () => {
    const cb = getCircuitBreaker('test-service');
    
    // Simular fallos
    for (let i = 0; i < 5; i++) {
      try {
        await cb.execute(async () => {
          throw new Error('Service failure');
        });
      } catch (e) {
        // Esperado
      }
    }
    
    expect(cb.getState().state).toBe('OPEN');
  });
});
```

---

## 🔗 Integración con Plataforma Principal

### 1. Headers de Autenticación

Tu plataforma principal debe enviar estos headers:

```typescript
// Desde tu plataforma principal
fetch('https://tu-app.com/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': 'user_12345',           // 👈 ID del usuario
    'x-session-token': 'session_token',  // 👈 Token de sesión
  },
  body: JSON.stringify({
    imageUrl: 'https://...',
    locale: 'es'
  })
});
```

### 2. Habilitar Autenticación

```env
# .env.local
AUTH_ENABLED=true
AUTH_USER_HEADER=x-user-id
AUTH_SESSION_HEADER=x-session-token
```

### 3. Crear Middleware de Autenticación

```typescript
// lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '../config/app.config';

export async function authMiddleware(req: NextRequest) {
  if (!APP_CONFIG.auth.ENABLED) {
    return null; // Skip auth
  }

  const userId = req.headers.get(APP_CONFIG.auth.USER_ID_HEADER);
  const sessionToken = req.headers.get(APP_CONFIG.auth.SESSION_TOKEN_HEADER);

  if (!userId || !sessionToken) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Missing authentication headers' },
      { status: 401 }
    );
  }

  // TODO: Validar token con tu plataforma
  // const valid = await validateToken(userId, sessionToken);
  // if (!valid) {
  //   return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 401 });
  // }

  return null; // Auth OK
}
```

### 4. Aplicar Middleware a Endpoints

```typescript
// app/api/analyze/route.ts
import { authMiddleware } from '../../../lib/middleware/auth';

export async function POST(req: Request) {
  // Verificar autenticación
  const authError = await authMiddleware(req);
  if (authError) return authError;

  // Resto del código...
}
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module '@upstash/redis'"

**Causa:** Paquete opcional no instalado.

**Solución:**
```bash
# Opción 1: Instalar Redis
npm install @upstash/redis

# Opción 2: Desactivar caché Redis
# .env.local
REDIS_URL=
```

### Rate Limiting no Funciona

**Causa:** Identificador de request no único.

**Solución:**
```typescript
// Asegúrate de que getRequestIdentifier devuelve un ID único
const identifier = req.headers.get('x-session-id') || 
                   req.headers.get('x-forwarded-for') ||
                   'fallback-id';
```

### Caché no Persiste entre Requests

**Causa:** Usando in-memory cache en desarrollo con hot reload.

**Solución:**
```bash
# Usa Redis en desarrollo
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### Circuit Breaker se Abre Constantemente

**Causa:** Threshold muy bajo o servicio realmente fallando.

**Solución:**
```env
# Aumentar threshold
AI_CIRCUIT_THRESHOLD=10
AI_CIRCUIT_RESET=60000
```

### Logs no Aparecen

**Causa:** LOG_LEVEL muy alto.

**Solución:**
```env
LOG_LEVEL=debug
```

---

## 📊 Monitoreo

### Ver Estadísticas de Caché

```typescript
// app/api/admin/stats/route.ts
import { getCacheStats } from '../../../lib/cache';

export async function GET() {
  const stats = getCacheStats();
  return NextResponse.json(stats);
}
```

Acceder: `http://localhost:3000/api/admin/stats`

### Ver Estado de Circuit Breakers

```typescript
import { getCircuitBreaker } from '../../../lib/resilience';

const geminiCB = getCircuitBreaker('gemini');
const state = geminiCB.getState();
console.log('Circuit Breaker State:', state);
```

---

## 🎉 ¡Listo!

Tu aplicación ahora tiene:
- ✅ Manejo robusto de errores
- ✅ Rate limiting
- ✅ Sistema de caché
- ✅ Validación de imágenes
- ✅ Sistema de créditos configurable
- ✅ Compliance (GDPR/CCPA)
- ✅ Circuit breaker pattern
- ✅ Retry logic

### Próximos Pasos

1. **Probar en ambiente de desarrollo**
2. **Configurar Redis (opcional pero recomendado)**
3. **Integrar con plataforma principal de créditos**
4. **Desplegar a staging**
5. **Pruebas de carga**
6. **Desplegar a producción**

---

**¿Preguntas?** Consulta los archivos de documentación en `/docs/`

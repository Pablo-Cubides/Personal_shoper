# 📦 Instalación de Dependencias Opcionales

## Redis (Upstash) - Recomendado para Producción

### ¿Por qué Redis?
- ✅ Caché distribuido entre múltiples instancias
- ✅ Rate limiting consistente
- ✅ Persistencia de datos de sesión
- ✅ Alta velocidad (<1ms latencia)

### Opción 1: Upstash (Recomendado - Free Tier Disponible)

1. **Crear cuenta en Upstash:**
   - Visita: https://upstash.com
   - Crea una cuenta gratuita
   - Crea una base de datos Redis

2. **Obtener credenciales:**
   ```
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

3. **Instalar dependencia:**
   ```bash
   npm install @upstash/redis
   ```

4. **Configurar en .env.local:**
   ```env
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   CACHE_ENABLED=true
   ```

5. **Verificar:**
   ```bash
   npm run dev
   # Check logs for: "cache.redis_initialized"
   ```

### Opción 2: Redis Local (Solo Desarrollo)

```bash
# Instalar Redis (Windows con WSL2)
wsl --install
wsl
sudo apt update
sudo apt install redis-server
redis-server

# En otra terminal
redis-cli ping
# Debería responder: PONG

# Configurar
REDIS_URL=redis://localhost:6379
```

---

## Sentry - Monitoreo de Errores (Opcional)

### ¿Por qué Sentry?
- ✅ Tracking automático de errores
- ✅ Stack traces completos
- ✅ Alertas en tiempo real
- ✅ Performance monitoring

### Setup

1. **Crear cuenta en Sentry:**
   - Visita: https://sentry.io
   - Crea una cuenta (free tier disponible)
   - Crea un proyecto "Next.js"

2. **Obtener DSN:**
   ```
   SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
   ```

3. **Instalar dependencia:**
   ```bash
   npm install @sentry/nextjs
   ```

4. **Configurar en .env.local:**
   ```env
   MONITORING_ENABLED=true
   SENTRY_DSN=https://your_dsn_here
   ```

5. **Inicializar Sentry:**

   Crear `sentry.client.config.ts`:
   ```typescript
   import * as Sentry from '@sentry/nextjs';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
     
     beforeSend(event, hint) {
       // Don't send errors in development
       if (process.env.NODE_ENV === 'development') {
         return null;
       }
       return event;
     },
   });
   ```

   Crear `sentry.server.config.ts`:
   ```typescript
   import * as Sentry from '@sentry/nextjs';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0,
   });
   ```

6. **Usar en tu código:**
   ```typescript
   import * as Sentry from '@sentry/nextjs';

   try {
     // Tu código
   } catch (error) {
     Sentry.captureException(error);
     throw error;
   }
   ```

---

## Pruebas con Vitest (Ya Incluido)

### Setup para Tests

1. **Archivos ya creados:**
   - ✅ `vitest.config.ts`
   - ✅ `tests/setup.ts`

2. **Crear tests:**

   ```typescript
   // tests/credits.test.ts
   import { describe, it, expect } from 'vitest';
   import { getActionCost, checkCredits, consumeCredits } from '../lib/credits';

   describe('Credits System', () => {
     it('should return 0 cost for analysis in testing mode', () => {
       expect(getActionCost('analyze')).toBe(0);
     });

     it('should return 0 cost for generation in testing mode', () => {
       expect(getActionCost('generate')).toBe(0);
     });

     it('should initialize new session with starting credits', async () => {
       const credits = await checkCredits('test-session-' + Date.now());
       expect(credits).toBeGreaterThan(0);
     });

     it('should not consume credits when not enforced', async () => {
       const sessionId = 'test-' + Date.now();
       const result = await consumeCredits(sessionId, 999, 'test');
       expect(result.ok).toBe(true);
     });
   });
   ```

3. **Ejecutar tests:**
   ```bash
   # Run once
   npm test

   # Watch mode
   npm run test:watch

   # Coverage
   npm run test:coverage
   ```

---

## DataDog / New Relic (Alternativa a Sentry)

### DataDog

```bash
npm install dd-trace

# Configurar
DD_API_KEY=your_key
DD_ENV=production
DD_SERVICE=abstain-app
```

### New Relic

```bash
npm install newrelic

# Configurar newrelic.js
# Seguir: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/
```

---

## Playwright - Tests End-to-End (Opcional)

### Setup

```bash
npm install -D @playwright/test
npx playwright install
```

### Ejemplo de test:

```typescript
// tests/e2e/analyze.spec.ts
import { test, expect } from '@playwright/test';

test('should analyze image successfully', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Upload image
  await page.setInputFiles('input[type="file"]', './tests/fixtures/test-image.jpg');
  
  // Wait for analysis
  await page.waitForSelector('.analysis-result', { timeout: 60000 });
  
  // Check result
  const result = await page.textContent('.analysis-result');
  expect(result).toContain('recomendación');
});
```

---

## K6 - Load Testing (Opcional)

### Setup

```bash
# Instalar K6
# Windows: choco install k6
# Mac: brew install k6
# Linux: sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
```

### Script de prueba:

```javascript
// tests/load/analyze.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests must complete below 5s
  },
};

export default function () {
  const payload = JSON.stringify({
    imageUrl: 'https://example.com/test.jpg',
    locale: 'es',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post('http://localhost:3000/api/analyze', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has analysis': (r) => r.json('analysis') !== undefined,
  });

  sleep(1);
}
```

### Ejecutar:

```bash
k6 run tests/load/analyze.js
```

---

## Winston - Logging Avanzado (Alternativa)

```bash
npm install winston
```

```typescript
// lib/logger/winston.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

---

## Resumen de Instalación

### Mínimo (Ya instalado)
```bash
npm install
```

### Recomendado (Producción)
```bash
npm install @upstash/redis @sentry/nextjs
```

### Completo (Con testing)
```bash
npm install @upstash/redis @sentry/nextjs
npm install -D @playwright/test
npx playwright install
```

### Verificar instalación
```bash
npm run validate-config
npm run build
npm test
```

---

## Troubleshooting

### Error: "Cannot find module '@upstash/redis'"

**Solución:**
```bash
npm install @upstash/redis
# O desactivar Redis en .env.local
REDIS_URL=
```

### Error: "Sentry DSN not configured"

**Solución:**
```env
# Desactivar monitoring
MONITORING_ENABLED=false
```

### Tests fallan

**Solución:**
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
npm test
```

---

## Costos Estimados

| Servicio | Free Tier | Paid |
|----------|-----------|------|
| **Upstash Redis** | 10K requests/day | $0.20/100K requests |
| **Sentry** | 5K events/month | $26/month (50K events) |
| **Vercel** | Hobby tier | $20/month (Pro) |
| **Cloudinary** | 25 credits/month | Variable |
| **Gemini API** | Pay per use | ~$0.0045/analysis |

**Total mensual (estimado para 10K usuarios):**
- Free tier: ~$270 (solo APIs)
- Con Redis+Sentry: ~$320/mes
- Con caché (40% hit): ~$200/mes

---

**Recomendación:** Empieza con free tiers y escala según necesidad.

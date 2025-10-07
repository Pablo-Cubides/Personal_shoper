# 💈 Abstain — Análisis de Rostro AI v2.0

Aplicación Next.js + TypeScript de análisis facial con IA que proporciona recomendaciones personalizadas de estilo de cabello y barba utilizando Google Gemini AI.

**🎉 Versión 2.0 - Fases 1-3 Completadas:**
- ✅ **Estabilización:** Error handling robusto, circuit breaker, rate limiting, validación
- ✅ **Optimización:** Sistema de caché, timeouts configurables, performance tracking
- ✅ **Compliance:** Política de privacidad, términos de servicio, privacy mode

**📚 [VER DOCUMENTACIÓN COMPLETA v2.0](./docs/README-V2.md)**

---

## 🚀 Quickstart Mejorado

```bash
# 1. Instalar
npm install

# 2. Configurar (interactivo)
npm run setup

# O configurar manualmente:
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Validar y ejecutar
npm run validate-config
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) 🎉

---

## 📖 Documentación v2.0

### 🆕 Nuevas Guías
- **[📋 Implementación Completa](./docs/IMPLEMENTATION.md)** - Setup y configuración detallada
- **[📊 Resumen de Cambios](./docs/SUMMARY.md)** - Estado de implementación
- **[📦 Dependencias Opcionales](./docs/OPTIONAL-DEPENDENCIES.md)** - Redis, Sentry, testing
- **[🔐 Política de Privacidad](./docs/privacy-policy.md)** - GDPR/CCPA compliant
- **[📜 Términos de Servicio](./docs/terms-of-service.md)** - Legal completo

### 📚 Documentación Original

## Contenidos
- `docs/architecture.md` — visión general y responsabilidades de cada componente
- `docs/api.md` — contrato de los endpoints (payloads, respuestas, códigos de estado, error modes)
- `docs/diagrams.md` — diagramas Mermaid (flujos y secuencias)
- `docs/development.md` — guía para desarrollo local, pruebas y smoke tests
- `docs/deployment.md` — guía de despliegue y consideraciones de seguridad


## Quickstart (local)
1. Copia `.env.local.example` a `.env.local` y rellena las variables necesarias (Cloudinary, GEMINI keys si las tienes).
2. Instala dependencias:

```powershell
cd "D:\Mis aplicaciones\Analisis rostro\abstain-app"
npm install
```

3. Levanta el servidor de desarrollo:

```powershell
npm run dev
```

4. Abrir http://localhost:3000 y subir una imagen. Los endpoints principales son `/api/upload`, `/api/analyze`, `/api/iterate`.


## Archivos clave
- `app/(public)/page.tsx` — UI principal (chat-like) y slider Before/After
- `app/api/upload/route.ts` — recibe subida y llama a `lib/storage.uploadToStorage`
- `app/api/analyze/route.ts` — llama a `lib/ai/gemini.analyzeImageWithGemini`
- `app/api/iterate/route.ts` — orquesta edición: moderación -> editWithNanoBanana -> fetch edited -> watermark -> upload
- `lib/ai/nanobanana.ts` — orquestador de ediciones: Gemini SDK -> Gemini REST proxy -> NanoBanana legacy; devuelve 503 si no hay editores
- `lib/storage.ts` — Cloudinary integration + local fallback; sanitiza `public_id`
- `data/generated_images.json` — registro local de imágenes generadas (para limpieza y auditoría)
- `logs/ai_calls.log` — registro de llamadas AI/ediciones para diagnóstico


## Notas rápidas de diseño
- No hay fallback a edición local (p. ej. Sharp) — si ningún editor remoto está disponible, la API responde 503 con mensaje claro.
- `uploadToStorage` sanitiza `public_id` para evitar espacios/char problemáticos en Cloudinary.
- `iterate` intenta borrar el `prevPublicId` exacto y una variante sanitizada (espacios -> `_`) para limpieza retrocompat.


---

Lee `docs/architecture.md` y `docs/api.md` para detalles técnicos y diagramas.

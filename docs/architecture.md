# Arquitectura del sistema — Abstain

Esta sección describe la arquitectura de alto nivel, responsabilidades de cada componente y por qué están organizados así.

## Resumen de alto nivel

Abstain es una aplicación web full-stack usando Next.js (App Router) y TypeScript. Se basa en APIs server-side (Next.js route handlers) que orquestan llamadas a servicios AI (Gemini / Vision / servicios REST), realizan moderación, aplican marcas de agua y almacenan los resultados en Cloudinary.

Principales capas:
- Frontend (Next.js React) — IU chat-like para subir imágenes, mostrar análisis y slider Before/After.
- API server (Next.js route handlers) — `upload`, `analyze`, `iterate`, `moderate`, `credits`.
- AI Orchestrator (`lib/ai/*`) — abstrae llamadas a Gemini SDK, REST proxies y servicios legacy.
- Storage (`lib/storage.ts`) — Cloudinary + local fallback.
- Logging/registry (`logs/*`, `data/generated_images.json`) — registro de actividades y recursos generados.

## Componentes y responsabilidades

- `app/(public)/page.tsx`
  - Chat UI, manejo de subida y flujo de interacción con el backend.
  - Inserta mensajes `system` para estados de proceso (p. ej. "Analizando tu foto...").

- `app/api/upload/route.ts`
  - Acepta multipart/form-data, extrae el archivo y lo sube con `uploadToStorage`.
  - Devuelve `imageUrl`, `sessionId`, y `publicId`.

- `app/api/analyze/route.ts`
  - Encapsula la llamada a `lib/ai/gemini.analyzeImageWithGemini`.
  - Devuelve un objeto `analysis` con `faceOk`, `hair`, `beard`, `suggestedText`, etc.

- `app/api/iterate/route.ts`
  - Flujo: moderación -> mapUserTextToIntent -> `editWithNanoBanana` -> fetch resultado -> watermark -> subir
  - Registra la imagen generada en `data/generated_images.json` y limpia la previa (dual-delete).
  - Responde 503 si ningún editor remoto está disponible (error con `status = 503`).

- `lib/ai/nanobanana.ts`
  - Orquesta los intentos de edición: Gemini SDK (preferido) -> Gemini REST proxy -> NanoBanana legacy.
  - Convierte imágenes base64 a subir si la respuesta lo requiere.
  - Si todo falla, lanza un error con status 503 para que la API responda con servicio no disponible.

- `lib/storage.ts`
  - Configura Cloudinary si `CLOUDINARY_URL` está presente y válida.
  - `uploadToStorage(buffer, filename)` devuelve `{ url, public_id }`.
  - `deleteFromStorage(publicId)` borra de Cloudinary o del filesystem local (prefix `local:`).

- `lib/ai/gemini.ts` (análisis)
  - Implementa `analyzeImageWithGemini`, que intenta usar Gemini SDK y, en su defecto, la API de Vision como fallback para detección básica.
  - Devuelve `FaceAnalysis` (interfaz bien definida).

## Decisiones de diseño clave

- Falta de fallback local para edición: evita resultados de menor calidad o divergentes. Preferimos fallar rápido (503) y notificar al usuario.
- Sanitización `public_id`: evita URLs defectuosas causadas por espacios y caracteres especiales.
- Registro local de imágenes generadas: mantiene un histórico sencillo y permite tareas de limpieza y auditoría.

## Extensibilidad

- Añadir un nuevo proveedor de edición: implementar un adaptador que devuelva `{ editedUrl, publicId?, note? }` y añadirlo al orden de preferencia en `lib/ai/nanobanana.ts`.
- Soporte multi-tenant: agregar prefijos por tenant en `uploadToStorage` (folder por tenant) y manejar límites de créditos en `lib/credits.ts`.


## Diagramas de componentes (ver `docs/diagrams.md` para más flujos)

- Frontend (Next.js) ↔ API routes (/api/upload, /api/analyze, /api/iterate)
- API routes ↔ lib/ai (Gemini SDK, Gemini REST Proxy, NanoBanana)
- API routes ↔ lib/storage (Cloudinary)
- Logs/registry ↔ local files (`logs/ai_calls.log`, `data/generated_images.json`)


---

Para ver ejemplos de payloads y secuencias de requests, revisa `docs/api.md` y `docs/diagrams.md`.

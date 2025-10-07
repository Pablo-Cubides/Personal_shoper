# API — Contratos y ejemplos

Este documento describe los endpoints HTTP expuestos por la aplicación, sus payloads, respuestas y códigos de error esperados.

Base URL (local): http://localhost:3000

## 1) POST /api/upload
Descripción: recibe un archivo (multipart/form-data) bajo la clave `file` o `image`, lo sube a almacenamiento (Cloudinary o `public/uploads`) y devuelve URL y `publicId`.

Request (multipart/form-data):
- file (File) — imagen

Response 200
```json
{ "imageUrl": "/uploads/xyz.jpg", "sessionId": "sess_169...", "publicId": "abstain/xyz" }
```

Errors:
- 400 { error: 'no_file' }
- 500 { error: 'upload_error' }


## 2) POST /api/analyze
Descripción: envía la imagen a `analyzeImageWithGemini` y devuelve el objeto `analysis`.

Request JSON
```json
{ "imageUrl":"https://.../uploads/abc.jpg", "locale":"es" }
```

Response 200
```json
{ "analysis": { "faceOk": true, "pose": "frontal", "hair": { ... }, "beard": { ... }, "suggestedText": "...", "advisoryText": "..." }, "workingUrl": "..." }
```

Errors: cualquier fallo en el análisis se registra y la ruta puede devolver 200 con `analysis` fallback (ver `lib/ai/gemini.ts`).


## 3) POST /api/iterate
Descripción: Orquesta la edición de la imagen. Flujo:
- Moderación
- mapUserTextToIntent
- Llamada al orquestador de edición (`editWithNanoBanana`)
- Fetch de la imagen editada
- Aplicar watermark
- Subir resultado y registrar
- Intentar borrar imagen anterior

Request JSON
```json
{
  "sessionId":"sess_...",
  "originalImageUrl":"https://.../uploads/abc.jpg",
  "userText":"Quiero un corte con fade medio y stubble",
  "prevPublicId":"abstain/old_image",
  "analysis": { /* opcional: análisis previo */ }
}
```

Success 200
```json
{ "editedUrl":"https://res.cloudinary.com/.../edited.jpg", "publicId":"abstain/edited_...", "note":"Editado con Gemini", "instruction":"..." }
```

Errors:
- 400 { error: 'missing' }
- 403 { error: 'moderation_blocked', reason: '...' }
- 502 { error: 'failed_to_fetch_edited_image' }
- 503 { error: 'AI image service unavailable. Please try again later.' } (cuando `editWithNanoBanana` no encuentra editores remotos)


## Contratos internos relevantes
- `FaceAnalysis` (ver `lib/ai/gemini.ts`) — la forma exacta que `analyze` devuelve y que `iterate` usa parcialmente.
- `EditIntent` (ver `lib/ai/nanobanana.ts`) — describe cambios deseados: `change[]`, `instruction`, `preserveIdentity`, `outputSize`, `watermark`.


## Consideraciones de seguridad
- Validar que `imageUrl` sea de confianza (si corresponde). Actualmente el servidor confía en la URL proporcionada (proviene normalmente del upload result).
- Moderación se ejecuta antes de editar para bloquear contenido inapropiado.
- Los secretos (Cloudinary, GEMINI keys) deben guardarse en variables de entorno y no en el repositorio.


---

Ejemplos de uso rápido (curl):

1) Subir imagen
```bash
curl -F "file=@/ruta/a/mi.jpg" http://localhost:3000/api/upload
```

2) Analizar
```bash
curl -X POST -H "Content-Type: application/json" -d '{"imageUrl":"<url>","locale":"es"}' http://localhost:3000/api/analyze
```

3) Iterar/editar
```bash
curl -X POST -H "Content-Type: application/json" -d '{"sessionId":"sess_...","originalImageUrl":"<url>","userText":"Quiero stubble"}' http://localhost:3000/api/iterate
```

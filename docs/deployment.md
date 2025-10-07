# Despliegue y Operaciones

Guía para desplegar la aplicación en producción, variables de entorno y consideraciones operativas.

## Variables de entorno críticas
- `CLOUDINARY_URL` — URL de Cloudinary con clave (recomendada para producción).
- `GEMINI_API_KEY` / `GOOGLE_API_KEY` — credenciales para Gemini Vision/Generative SDK.
- `GEMINI_REST_URL` — endpoint alternativo si usas un proxy o servicio REST.
- `NANOBANANA_URL`, `NANOBANANA_API_KEY` — legacy.
- `NODE_ENV=production` para builds de Next optimizados.
- `BETTERSTACK_LOG_ENDPOINT`, `BETTERSTACK_TOKEN` — reenvío de logs hacia Better Stack/Logtail (opcional).
- `BETTERSTACK_TIMEOUT_MS`, `LOGTAIL_ALLOW_INSECURE` — ajustes finos de la integración de logs.
- `GOOGLE_VISION_API_KEY` (o `GOOGLE_API_KEY`) — habilita la moderación con Cloud Vision.
- `GOOGLE_VISION_TIMEOUT` — timeout opcional (ms) para las llamadas a Cloud Vision.

## Recomendaciones de hosting
- Next.js puede desplegarse en Vercel, Railway, Render, o en VPS con Node/PM2.
- Recomendado: Vercel para despliegue simple y CDN automático, Cloudinary para imágenes.
- Si usas Vercel y Gemini SDK que requiere credenciales, añade las variables en el panel de entorno.

## Seguridad
- Nunca guardes secretos en el repositorio; usa variables de entorno o secret manager.
- Limita el acceso a `logs/ai_calls.log` y `data/generated_images.json` en entornos compartidos.
- Si usas claves de Google que requieren OAuth2, configura correctamente roles y permisos (Generative AI, Vision API).

## Escalado
- El cuello de botella suele ser llamadas a AI externas y fetch de imágenes. Considera:
  - Cachear imágenes públicas en Cloudinary
  - Usar colas para procesar ediciones pesadas (ej. un worker que procese `iterate` y notifique por WebSocket)

## Monitoreo
- Añade métricas en `lib/metrics.ts` y usa PostHog/Datadog para tasas de error y latencias.
- Alertas recomendadas:
  - Aumento de 503 desde `iterate` (indica que el editor remoto está caído)
  - Errores 502 (fetch edited failed)

## Backups y limpieza
- `data/generated_images.json` puede crecer; programa un job que limpie entradas antiguas y borre imágenes en Cloudinary.
- Script de limpieza: `npm run cleanup:registry` (usa `scripts/cleanup_by_registry.js`).

## Rolling updates y migraciones
- Para cambios en `lib/storage.ts` que afecten `public_id`, considera un script de migración que renombre/elimine entradas antiguas.

---

Si quieres, genero también un playbook de incidentes mínimo (cómo actuar cuando Gemini devuelve 401/404 o cuando Cloudinary 404) y un `makefile` para tareas frecuentes.
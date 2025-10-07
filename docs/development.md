# Desarrollo — guía completa

Esta guía ayuda a configurar el entorno local, correr pruebas, depurar y añadir nuevas integraciones de AI.

## Requisitos
- Node.js 18+ (recomendado 20)
- npm
- Variables de entorno (usar `.env.local`):
  - `CLOUDINARY_URL` (opcional si usas Cloudinary)
  - `GOOGLE_API_KEY` o `GEMINI_API_KEY` (para Gemini Vision / Generative)
  - `GEMINI_REST_URL` (opcional, proxy REST para ediciones)
  - `NANOBANANA_URL` y `NANOBANANA_API_KEY` (legacy)

## Instalación y arranque
```powershell
cd "D:\Mis aplicaciones\Analisis rostro\abstain-app"
npm install
npm run dev
```

## Pruebas rápidas (smoke)
- Hay un script de smoke test en `scripts/smoke_test_run.js` que ejecuta un flujo de prueba contra `http://localhost:3000`.
- Antes de ejecutarlo, asegúrate de que el servidor esté en ejecución y que `Test-NetConnection -ComputerName localhost -Port 3000` reporte `TcpTestSucceeded: True` en PowerShell.

```powershell
$env:BASE_URL='http://localhost:3000'
node .\scripts\smoke_test_run.js
```

## Depuración de problemas comunes
- Problema: `ECONNREFUSED` desde el smoke test
  - Asegúrate de que Next está escuchando en `localhost` (no en otra interfaz). Revisa la salida de `npm run dev`.
  - Revisa firewall/antivirus que pueda bloquear conexiones locales.
  - Si `npm run dev` muestra `Local: http://localhost:3000` pero `Test-NetConnection` falla, intenta reiniciar el terminal o usar `127.0.0.1` como host.

- Problema: Gemini/Vision devuelve 401 o 404
  - Verifica que `GEMINI_API_KEY`/`GOOGLE_API_KEY` esté configurado.
  - Revisa `AI_CONFIG.md` y `scripts/check_gemini_config.js` para validar permisos y scopes.
  - Si la SDK lanza errores de tipo `API keys are not supported by this API`, significa que el flujo requiere OAuth2/Service Account; ejecutar los scripts de `scripts/test_sa_auth_call.js` para validar.

- Problema: Cloudinary 404 por `public_id` con espacios
  - Se implementó sanitización en `lib/storage.ts` que reemplaza caracteres inseguros por `_`.
  - Para limpiar imágenes antiguas, usa `npm run cleanup:registry` que ejecuta `scripts/cleanup_by_registry.js`.

## Añadir un nuevo proveedor de edición
1. Implementa un adaptador en `lib/ai/` que exponga una función `editWithX(imageUrl, intent)` y devuelva `{ editedUrl, publicId?, note? }`.
2. Añade el adaptador al orden de preferencia en `lib/ai/nanobanana.ts`.
3. Registra logs mediante `appendLog({ phase: 'nanobanana.call.x', ... })`.

## Formato de logs
- `logs/ai_calls.log` contiene líneas JSON append-only con eventos: `phase` y payload.
- Útil para reproducir fallos al inspeccionar secuencias de llamadas.

## Tips de rendimiento
- Para reducciones de latencia, sirve imágenes desde CDN (Cloudinary) y evita fetch innecesarios en servidores lentos.
- Habilita `next start` con PM2 o un reverse proxy para producción.


---

Si quieres, puedo generar tests unitarios mínimos (Jest) para `lib/storage.ts` y `lib/ai/nanobanana.ts` que aseguren la sanitización y el manejo de errores 503. ¿Los quieres ahora?
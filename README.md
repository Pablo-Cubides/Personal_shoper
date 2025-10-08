# 💈 Abstain — Asesor de Estilo Corporal v2.0

Aplicación Next.js + TypeScript de análisis de imagen que proporciona recomendaciones personalizadas de ropa, colores y accesorios usando Google Gemini AI.

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
# Personal_shoper

Tu Asesor de Estilo Personal — aplicación Next.js para recibir recomendaciones de outfit a partir de una foto.

Este repositorio contiene la aplicación web (Next.js App Router + TypeScript) que permite a los usuarios subir una foto, analizarla (visión por computador), generar una imagen editada (servicio externo) y recibir recomendaciones de estilo.

---

## Tabla de contenidos

- [Quickstart](#quickstart)
- [Arquitectura](#arquitectura)
- [Rutas API importantes](#rutas-api-importantes)
- [Variables de entorno](#variables-de-entorno)
- [Tests y mocks (MSW)](#tests-y-mocks-msw)
- [Accesibilidad y UX](#accesibilidad-y-ux)
- [Despliegue](#despliegue)
- [Contribuir](#contribuir)
- [Seguridad y buenas prácticas](#seguridad-y-buenas-pr%C3%A1cticas)
- [Changelog resumido](#changelog-resumido)
- [Documentación extendida (docs/)](#documentaci%C3%B3n-extendida-docs)

---

## Quickstart

Requisitos:
- Node.js (>=18)
- pnpm / npm
- Variables de entorno en `.env.local` (ver sección abajo)

Instala dependencias:

```bash
pnpm install
# o
npm install
```

En desarrollo:

```bash
pnpm dev
# o
npm run dev
```

Compilar producción:

```bash
pnpm build
pnpm start
```

Correr tests (Vitest):

```bash
pnpm test
```

---

## Arquitectura

Resumen de alto nivel:

- Frontend: Next.js (App Router, React + TypeScript). Código principal de la interfaz en `app/(public)/page.tsx`, estilos globales en `app/globals.css`.
- Backend: Rutas API dentro de `app/api/*` que realizan:
	- `/api/upload`: recibe la imagen desde el cliente y la guarda/procesa (p.ej. Cloudinary).
	- `/api/analyze`: ejecuta análisis por visión (Google Vision u otro) para validar la foto y producir recomendaciones preliminares.
	- `/api/iterate`: solicita al servicio de generación de imágenes la imagen editada (puede ser un servicio externo de edición/AI).
	- `/api/moderate`: (opcional) punto para moderación de contenido.
- Tests: Vitest + MSW (mocks) para simular backend en pruebas.
- Utilidades: `lib/validation` y otros helpers para validaciones y transformaciones.

Puntos de entrada importantes:
- `app/(public)/page.tsx` — UI principal: subida, drag & drop, barra de progreso, chat y control de conversación.
- `app/globals.css` — tokens de diseño, progress bar, drop-zone y animaciones.
- `tests/__mocks__/server.ts` — handlers MSW para los tests.

---

## Rutas API importantes

- POST `/api/upload`
	- FormData con `file` (imagen). Retorna JSON:
		```json
		{ "imageUrl": "https://...", "sessionId": "...", "publicId": "..." }
		```
	- Errores: devuelve `error` y código HTTP adecuado.

- POST `/api/analyze`
	- Body: `{ imageUrl, locale }` — devuelve análisis, `analysis.advisoryText`, flags `bodyOk`/`faceOk`, y `suggestedText`.

- POST `/api/iterate`
	- Body: `{ sessionId, originalImageUrl, userText, prevPublicId, analysis }` — solicita la imagen editada.
	- Responde con `{ editedUrl, publicId, note }` o `error` si falla.

Consulta `docs/APIS.md` para ejemplos y detalles de formato.

---

## Variables de entorno

Ejemplo de `.env.local` (no almacenar en VCS):

```
NODE_ENV=development
NEXT_PUBLIC_MAX_IMAGE_SIZE_MB=10
GEMINI_API_KEY=...
GEMINI_MODEL=...
GOOGLE_VISION_SERVICE_ACCOUNT_PATH=path/to/service-account.json
BETTERSTACK_TOKEN=...
CLOUDINARY_URL=...
```

Notas:
- `NEXT_PUBLIC_MAX_IMAGE_SIZE_MB` controla la validación cliente de tamaño. El servidor siempre debe validar también.
- `GEMINI_API_KEY` / `GEMINI_MODEL` se usan si hay integraciones de modelo.
- Evita exponer claves privadas en el cliente.

---

## Tests y mocks (MSW)

- Ejecutar tests: `pnpm test` (Vitest)
- MSW se usa para interceptar peticiones HTTP durante tests. Revisa `tests/__mocks__/server.ts` si agregas handlers nuevos.
- Problema conocido: MSW advertirá sobre requests sin handlers (p. ej. OPTIONS/GET de health checks); añade handlers genéricos para silenciarlos en `tests/__mocks__/server.ts`.

---

## Accesibilidad y UX

Este proyecto implementa varias mejoras de accesibilidad y UX:
- Indicadores de carga multi-fase y `aria-live` para anunciar cambios (subiendo, analizando, generando).
- `role="log"`/`aria-live="polite"` en la lista de mensajes.
- Teclas: `Escape` aborta uploads; `Enter` envía un prompt (desde textarea sin shift).
- Focus visibles y animaciones suaves.

Consulta `docs/ACCESSIBILITY.md` para checklist y cómo validar.

---

## Despliegue

Este es un proyecto Next.js convencional. Para desplegar:

- Vercel: conectar el repo y configurar variables de entorno.
- Docker: construir con `npm run build` y servir con `npm start`.

Asegúrate de configurar los secretos en la plataforma de despliegue y los endpoints externos (Cloudinary, servicios de edición y visión).

---

## Contribuir

Lee `docs/CONTRIBUTING.md` para guía de estilo, branch workflow y cómo crear PRs. En resumen:
- Trabaja en ramas feature/ o fix/ y abre PR hacia `main`.
- Incluye tests y actualiza documentación cuando sea necesario.

---

## Seguridad y buenas prácticas

- Valida siempre el tamaño y tipo de archivo en el servidor, no confíes sólo en la validación cliente.
- Aplica rate-limiting y límites por sesión (ya existe una limitación en memoria para pruebas; en producción usar Redis/IP bucket).
- No subir secretos a GitHub. Usa variables de entorno en la plataforma de despliegue.

---

## Changelog resumido (últimos cambios)

- Implementada barra de progreso multi-fase (uploading → analyzing → generating) con animación indeterminada y ARIA live.
- Subida por XHR para capturar progreso y admitir aborto con `Escape`.
- Zona de drag & drop con highlight.
- Gating de sugerencias hasta que exista la `editedUrl`.
- Mejora de accesibilidad (aria, role=log, focus-visible) y animaciones para mensajes.
- Botón "Empezar de nuevo" para resetear conversación.
- Estándar de espaciado y skeleton placeholders para imágenes.

---

## Documentación extendida (docs/)

Hay una carpeta `docs/` con documentación extendida: `APIS.md`, `ACCESSIBILITY.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.

Si quieres que amplíe alguna sección (por ejemplo, sample payloads más extendidos, diagramas de arquitectura o scripts de CI), dime cuál y lo agrego.

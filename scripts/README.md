# Scripts de Utilidad y Mantenimiento

Este directorio contiene varios scripts para ayudar con la configuración, pruebas, mantenimiento y diagnóstico de la aplicación. Todos los scripts están escritos en TypeScript.

## Cómo Ejecutar los Scripts

Para ejecutar cualquiera de estos scripts, necesitarás `ts-node`. Puedes ejecutar un script usando `npx` de la siguiente manera:

```bash
npx ts-node scripts/nombre-del-script.ts
```

---

## Listado de Scripts

### Configuración y Validación

- **`setup.ts`**
  - **Propósito:** Un script interactivo que te guía en la creación del archivo de configuración `.env.local` preguntando por los valores necesarios (API keys, etc.).
  - **Uso:** `npx ts-node scripts/setup.ts`

- **`validate-config.ts`**
  - **Propósito:** Valida que el archivo `.env.local` contenga todas las variables de entorno requeridas y que sus valores no sean placeholders.
  - **Uso:** `npx ts-node scripts/validate-config.ts`

- **`check_gemini_config.ts`**
  - **Propósito:** Verifica en detalle la configuración de Gemini, incluyendo la API Key, el modelo y la disponibilidad del SDK. Intenta una llamada de prueba a la API de Gemini para asegurar la conectividad.
  - **Uso:** `npx ts-node scripts/check_gemini_config.ts`

- **`sync_config.ts`**
  - **Propósito:** Extrae un bloque de código JSON del archivo `AI_CONFIG.md` y lo guarda como `ai_config.json`.
  - **Uso:** `npx ts-node scripts/sync_config.ts`

### Pruebas y Diagnóstico

- **`smoke_test.ts` / `smoke_test_run.ts`**
  - **Propósito:** Realiza una prueba de humo ("smoke test") completa del flujo principal de la aplicación: sube una imagen, la analiza y solicita una edición.
  - **Uso:** `npx ts-node scripts/smoke_test.ts`

- **`test_flow.ts`**
  - **Propósito:** Similar a `smoke_test`, ejecuta una prueba del flujo completo de la API.
  - **Uso:** `npx ts-node scripts/test_flow.ts`

- **`test_gemini_analysis.ts`**
  - **Propósito:** Script enfocado en probar específicamente la capacidad de análisis de imágenes de Gemini Vision con un prompt detallado.
  - **Uso:** `npx ts-node scripts/test_gemini_analysis.ts`

- **`check_iterate_503.ts`**
  - **Propósito:** Prueba el manejo de errores del endpoint `/api/iterate`, verificando que devuelva un código 503 cuando se espera.
  - **Uso:** `npx ts-node scripts/check_iterate_503.ts`

- **`list_available_models.ts`**
  - **Propósito:** Se conecta a la API de Google y lista todos los modelos de IA generativa que están disponibles para tu API Key.
  - **Uso:** `npx ts-node scripts/list_available_models.ts`

### Autenticación y SDK (Avanzado)

- **`diagnose_ga_sdk.ts`**
  - **Propósito:** Un script de diagnóstico avanzado para probar la edición de imágenes usando el SDK de Google AI con credenciales de una cuenta de servicio (Service Account).
  - **Uso:** `npx ts-node scripts/diagnose_ga_sdk.ts`

- **`test_sa_auth_call.ts` / `test_sa_auth_call_scopes.ts`**
  - **Propósito:** Prueban la obtención de un token de autenticación de Google Cloud usando una cuenta de servicio con diferentes "scopes" o permisos.
  - **Uso:** `npx ts-node scripts/test_sa_auth_call.ts`

- **`inspect_ga.ts` / `inspect_ga_proto.ts` / `inspect_model_sync.ts` / `try_ga_client.ts`**
  - **Propósito:** Son scripts de introspección de bajo nivel para depurar el SDK de `@google/generative-ai`. Muestran información sobre los objetos, prototipos y métodos exportados por la librería.
  - **Uso:** Para depuración avanzada del SDK.

### Mantenimiento

- **`cleanup_by_registry.ts`**
  - **Propósito:** Elimina imágenes antiguas del proveedor de almacenamiento (ej. Cloudinary) basándose en la fecha de creación guardada en `data/generated_images.json`. Por defecto, elimina las de más de 24 horas.
  - **Uso:** `npx ts-node scripts/cleanup_by_registry.ts [horas]` (el argumento de horas es opcional).

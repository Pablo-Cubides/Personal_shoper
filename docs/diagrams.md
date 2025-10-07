# Diagramas y flujos (Mermaid)

Los diagramas están en formato Mermaid para que puedas pegarlos en Markdown renderers compatibles o en VS Code con la extensión Mermaid Preview.

## 1) Diagrama de componentes

```mermaid
flowchart TD
  WebUI[(Next.js Web UI)] -->|POST /api/upload| UploadAPI[Upload Route]
  WebUI -->|POST /api/analyze| AnalyzeAPI[Analyze Route]
  WebUI -->|POST /api/iterate| IterateAPI[Iterate Route]

  UploadAPI --> Storage[Cloudinary / local uploads]
  AnalyzeAPI --> Gemini[Gemini SDK / Vision API]
  IterateAPI --> Moderation[Image Moderation]
  IterateAPI --> Nanobanana[AI Orchestrator (nanobanana)]
  Nanobanana --> Gemini
  Nanobanana --> GeminiREST[Gemini REST Proxy]
  Nanobanana --> NanoBananaLegacy[Legacy NanoBanana Service]
  IterateAPI --> Storage
  IterateAPI --> Registry[data/generated_images.json]
  IterateAPI --> Logs[logs/ai_calls.log]
```

## 2) Secuencia: upload -> analyze -> iterate (happy path)

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Next.js UI
  participant S as /api/upload
  participant A as /api/analyze
  participant I as /api/iterate
  participant N as nanobanana
  participant CL as Cloudinary

  U->>UI: Subir imagen
  UI->>S: POST /api/upload (file)
  S->>CL: uploadToStorage
  CL-->>S: {url, public_id}
  S-->>UI: {imageUrl, sessionId, publicId}

  UI->>A: POST /api/analyze {imageUrl}
  A->>N: analyzeImageWithGemini
  N-->>A: {analysis}
  A-->>UI: {analysis}

  UI->>I: POST /api/iterate {imageUrl, userText, prevPublicId}
  I->>Moderation: moderateImage
  Moderation-->>I: {ok:true}
  I->>N: editWithNanoBanana
  N->>Gemini: (preferred) SDK call
  Gemini-->>N: {base64 or url}
  N->>I: {editedUrl}
  I->>I: fetch(editedUrl) -> watermark -> uploadToStorage
  I->>CL: uploadToStorage(withMark)
  CL-->>I: {url, public_id}
  I->>Registry: persist generated image
  I-->>UI: {editedUrl, publicId}
  UI-->>U: Muestra Before/After
```

## 3) Error path: no remote editors

```mermaid
sequenceDiagram
  participant UI
  participant I as /api/iterate
  participant N as nanobanana

  UI->>I: POST /api/iterate
  I->>N: editWithNanoBanana
  N->>Gemini: SDK -> fail
  N->>GeminiREST: REST -> fail
  N->>NanoBananaLegacy: -> fail
  N-->>I: Error(status=503)
  I-->>UI: HTTP 503 {error: 'AI image service unavailable...'}
```


---

Pega estos diagramas en un visor Mermaid o en GitHub (si soporta mermaid) para visualizarlos.

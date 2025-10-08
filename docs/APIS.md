# API Reference

This file documents the main backend API endpoints used by the Personal_shoper application.

## POST /api/upload

Description:
- Receives a multipart/form-data payload containing a file field named `file` (image).
- Validates type and size server-side, stores (e.g. Cloudinary) and returns a canonical `imageUrl`.

Request (multipart/form-data):
- file: image/*

Response (200):
```json
{
  "imageUrl": "https://res.cloudinary.com/xxx/image/upload/v1234/abcd.jpg",
  "sessionId": "session-xxxx",
  "publicId": "abcd"
}
```

Error example (413):
```json
{ "error": "image_too_large", "message": "Image exceeds size limit" }
```


## POST /api/analyze

Description:
- Receives `{ imageUrl, locale }` and runs a visual analysis (e.g., body detection, face detection, clothing cues).
- Returns analysis object that includes `advisoryText`, `bodyOk` / `faceOk` flags, and a suggested textual prompt to seed the iterate endpoint.

Request (application/json):
```json
{ "imageUrl": "https://...", "locale": "es" }
```

Response (200):
```json
{
  "analysis": {
    "bodyOk": true,
    "faceOk": true,
    "advisoryText": "Buena iluminación, cuerpo visible...",
    "suggestedText": "Recomienda un outfit casual elegante"
  }
}
```

## POST /api/iterate

Description:
- Receives an object `{ sessionId, originalImageUrl, userText, prevPublicId, analysis }` and requests the image edit from the image generation service.
- This endpoint may forward the request to an external AI service and return the edited image URL.

Request example:
```json
{
  "sessionId":"session-xxxx",
  "originalImageUrl":"https://...",
  "userText":"Quiero una chaqueta más ajustada y colores más fríos",
  "prevPublicId":"abcd",
  "analysis": { }
}
```

Response example (200):
```json
{ "editedUrl": "https://res.cloudinary.com/.../edited_abcd.jpg", "publicId": "edited_abcd", "note": "Edición completada" }
```

Error example (503):
```json
{ "error": "service_unavailable", "message": "Image editing service unavailable" }
```


## Moderation and other endpoints

- `/api/moderate` - optional; validate content for policy compliance.


# Error handling conventions

- Successful responses use HTTP 200 with a JSON payload.
- Client errors use 4xx; server errors use 5xx.
- When returning an error JSON, include an `error` short code and `message` friendly description.


# Integration notes

- Server should always re-validate uploaded images (size/type). Client validation is convenience only.
- Iterate endpoint can be slow; callers should expect long-running requests and show progress UI.
- Consider emitting events or webhooks if backend will offload heavy tasks.

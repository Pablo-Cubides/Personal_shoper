import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock API responses for testing
export const handlers = [
  // Upload endpoint
  http.post('/api/upload', async () => {
    return HttpResponse.json({
      imageUrl: 'https://res.cloudinary.com/test/test-image.jpg',
      sessionId: 'test-session-123',
      publicId: 'abstain/test-image'
    });
  }),

  // Analyze endpoint
  http.post('/api/analyze', async ({ request }) => {
    const body = await request.json() as { imageUrl: string; locale: string };

    if (!body.imageUrl) {
      return HttpResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    return HttpResponse.json({
      analysis: {
        faceOk: true,
        pose: 'frontal',
        hair: {
          style: 'corto',
          color: 'negro',
          condition: 'buena'
        },
        beard: {
          style: 'stubble',
          length: 'corto'
        },
        suggestedText: 'Te recomendamos un corte moderno con barba recortada.',
        advisoryText: 'Considera mantener el cabello bien hidratado.'
      },
      workingUrl: 'https://res.cloudinary.com/test/analyzed-image.jpg'
    });
  }),

  // Iterate endpoint
  http.post('/api/iterate', async ({ request }) => {
    const body = await request.json() as {
      sessionId: string;
      originalImageUrl: string;
      userText: string;
      prevPublicId?: string;
    };

    if (!body.sessionId || !body.originalImageUrl || !body.userText) {
      return HttpResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    return HttpResponse.json({
      editedUrl: 'https://res.cloudinary.com/test/edited-image.jpg',
      publicId: 'abstain/edited-image-123',
      note: 'Edited with Gemini',
      instruction: 'Applied user requested changes'
    });
  }),

  // Moderate endpoint
  http.post('/api/moderate', async () => {
    return HttpResponse.json({ approved: true });
  }),

  // Credits endpoint
  http.post('/api/credits/consume', async () => {
    return HttpResponse.json({ success: true, remainingCredits: 95 });
  }),

  // Error scenarios
  http.post('/api/analyze-error', async () => {
    return HttpResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }),

  http.post('/api/rate-limit', async () => {
    return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }),

  http.post('/api/unauthorized', async () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  })
];

export const server = setupServer(...handlers);
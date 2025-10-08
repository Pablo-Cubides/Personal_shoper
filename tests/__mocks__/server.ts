import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock API responses for testing
export const handlers = [
  // Generic GET/OPTIONS handlers for local test server probes (healthchecks / preflight)
  http.options('http://localhost:3001/*', async () => {
    return HttpResponse.json({}, { status: 204 });
  }),
  http.get('http://localhost:3001/*', async () => {
    // return a minimal 200 so health checks succeed during integration guard
    return HttpResponse.json({ ok: true });
  }),
  // Specific root handler - some probes request GET / without host
  http.options('/', async () => {
    return HttpResponse.json({}, { status: 204 });
  }),
  http.get('/', async () => {
    return HttpResponse.json({ ok: true });
  }),
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
        // Body-focused analysis (new schema)
        bodyOk: true,
        pose: 'frontal',
        bodyType: 'rectangle',
        proportions: { shoulders: 'balanced', waist: 'average', hips: 'balanced' },
        clothing: {
          top: 'camisa blanca',
          bottom: 'pantalón oscuro',
          outer: 'chaqueta estructurada',
          fit: 'regular',
          colors: ['blanco', 'negro']
        },
        skinTone: 'medio',
        lighting: 'good',
        suggestedText: 'Te recomendamos una chaqueta estructurada y pantalón recto.',
        advisoryText: 'Considera prendas que equilibren tus proporciones y paletas neutras para un look equilibrado.',
        recommended: [
          {
            category: 'outfit',
            recommendation: 'Chaqueta estructurada con camisa neutra y pantalón recto',
            colors: ['neutro'],
            reason: 'Equilibra la silueta y aporta estructura'
          }
        ],

        // Clean body-focused analysis only (no legacy fields)
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
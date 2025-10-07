import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

async function run() {
  const httpBase = process.env.BASE_URL || 'http://localhost:3000';
  const filePath = path.join(__dirname, '..', 'public', 'uploads', 'imagen_prueba_din.jpg');
  if (!fs.existsSync(filePath)) return console.error('Test image not found:', filePath);

  console.log('Using base URL:', httpBase);
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath));

  try {
    const up = await axios.post(httpBase + '/api/upload', fd, { headers: fd.getHeaders() });
    console.log('upload status', up.status);
    const j = up.data;
    console.log('upload result', j);

    const an = await axios.post(httpBase + '/api/analyze', { imageUrl: j.imageUrl });
    console.log('analyze', an.data);

    const it = await axios.post(httpBase + '/api/iterate', { originalImageUrl: j.imageUrl, userText: 'Quiero el pelo mas corto', prevPublicId: j.publicId });
    console.log('iterate', it.data);
  } catch (e: unknown) {
    console.error('smoke test error', e instanceof Error ? e.toString() : String(e));
    // axios response guard
    if (typeof e === 'object' && e !== null && 'response' in e) {
      const resp = (e as Record<string, unknown>)['response'];
      if (resp && typeof resp === 'object') {
        const r = resp as Record<string, unknown>;
        const status = r['status'] as number | undefined;
        const data = r['data'];
        console.error('response data', status, data);
      }
    }
    // Handle AggregateError-like structures
    if (typeof e === 'object' && e !== null && 'errors' in (e as Record<string, unknown>)) {
      const asRec = e as Record<string, unknown>;
      const maybeErrors = asRec['errors'];
      if (Array.isArray(maybeErrors)) {
        console.error('AggregateError details:');
        maybeErrors.forEach((err, i) => {
          console.error(`#${i}`, err instanceof Error && err.stack ? err.stack : String(err));
        });
      }
    }
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(2);
  }
}

run();

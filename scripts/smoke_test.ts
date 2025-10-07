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
  } catch (err: unknown) {
    console.error('smoke test error', err instanceof Error ? err.message : String(err));
    // axios may attach response on errors — best-effort safe logging
    if (err && typeof err === 'object' && 'response' in err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = (err as any).response;
      if (resp && 'data' in resp) {
        console.error('response data', resp.data);
      }
    }
    process.exit(2);
  }
}

run();

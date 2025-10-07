import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

(async () => {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'uploads', 'imagen_prueba_din.jpg');
    if (!fs.existsSync(filePath)) return console.error('Test image not found:', filePath);
    const fd = new FormData();
    fd.append('file', fs.createReadStream(filePath));
    const up = await fetch('http://localhost:3002/api/upload', { method: 'POST', body: fd });
    console.log('upload status', up.status);
  const j = await up.json();
  console.log('upload result', j);

  const uploadResult = j as unknown;
  let imageUrl: string | undefined = undefined;
  let publicId: string | undefined = undefined;
  if (uploadResult && typeof uploadResult === 'object') {
    const u = uploadResult as Record<string, unknown>;
    if (typeof u.imageUrl === 'string') imageUrl = u.imageUrl;
    if (typeof u.publicId === 'string') publicId = u.publicId;
  }

  const an = await fetch('http://localhost:3002/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
  console.log('analyze', await an.json());

  const it = await fetch('http://localhost:3002/api/iterate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ originalImageUrl: imageUrl, userText: 'Quiero el pelo mas corto', prevPublicId: publicId }) });
  console.log('iterate', await it.json());
  } catch (err: unknown) {
      console.error('test flow error', err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }
})();

import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import { Part } from '@google/generative-ai';

(async () => {
  try {
    const sa = path.join(process.cwd(), 'secrets', 'pacific-plating-473817-c9-89790fa72698.json');
    if (!fs.existsSync(sa)) { console.error('SA file not found at', sa); process.exit(2); }
    process.env.GOOGLE_APPLICATION_CREDENTIALS = sa;
    console.log('Using SA file:', sa);

    const ga = require('@google/generative-ai');
    console.log('SDK loaded, exports:', Object.keys(ga));
    if (typeof ga.GoogleGenerativeAI !== 'function') {
      console.warn('GoogleGenerativeAI export not a function, keys:', Object.keys(ga));
    }
    const G = ga.GoogleGenerativeAI;
    const client = new G();
    const modelName = process.env.GOOGLE_IMAGE_MODEL || 'generative-image-1';
    console.log('Requesting model:', modelName);
    const model = client.getGenerativeModel({ model: modelName });
    console.log('Model acquired. Preparing image...');

    const localTest = path.join(process.cwd(), 'public', 'uploads', 'imagen_prueba_din.jpg');
    let imageUrl: Part;
    if (fs.existsSync(localTest)) {
      const b = fs.readFileSync(localTest);
      const base64 = b.toString('base64');
      imageUrl = { inlineData: { data: base64, mimeType: 'image/jpeg' } };
      console.log('Using local test image at', localTest);
    } else {
      const remote = 'https://images.unsplash.com/photo-1607746882042-944635dfe10e';
      console.log('Using remote test image', remote);
      const r = await fetch(remote);
      const ab = await r.arrayBuffer();
      const base64 = Buffer.from(ab).toString('base64');
      imageUrl = { inlineData: { data: base64, mimeType: r.headers.get('content-type') || 'image/jpeg' } };
    }

    const prompt = 'Make the hair slightly shorter while preserving identity';
    console.log('Calling generateContent...');
    const call = await model.generateContent([prompt, imageUrl]);
    console.log('Raw call result:', call);
    const resp = call && call.response ? call.response : call;
    console.log('Response object keys:', Object.keys(resp || {}));
    if (resp && resp.candidates) {
      console.log('Candidates length:', resp.candidates.length);
      console.log(JSON.stringify(resp.candidates[0], null, 2));
    }
    console.log('Done');
    process.exit(0);
  } catch (e: unknown) {
    console.error('SDK error', e instanceof Error ? e.message : String(e));
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(3);
  }

})().catch((e: unknown) => { console.error(e instanceof Error ? e : String(e)); process.exit(1); });

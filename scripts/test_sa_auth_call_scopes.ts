import path from 'path';
import fs from 'fs';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';

(async () => {
  try {
    const sa = path.join(process.cwd(), 'secrets', 'pacific-plating-473817-c9-89790fa72698.json');
    if (!fs.existsSync(sa)) { console.error('SA file not found at', sa); process.exit(2); }
    console.log('Using SA file:', sa);
    const scopes = ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language'];
    console.log('Requesting scopes:', scopes);
    const auth = new GoogleAuth({ keyFilename: sa, scopes });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('Access token retrieved (truncated):', String(token && token.token).slice(0, 80));
    const model = 'generative-image-1';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}`;
    console.log('Calling', url);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token.token}` } });
    console.log('Status', res.status, res.statusText);
    const txt = await res.text();
    console.log('Body:', txt);
    process.exit(0);
  } catch (err: unknown) {
    console.error('ERR', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }
})();

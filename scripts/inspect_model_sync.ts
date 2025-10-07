import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const m = client.getGenerativeModel({ model: 'generative-image-1' });
console.log('model kind', typeof m);
console.log('proto props', Object.getOwnPropertyNames(Object.getPrototypeOf(m)));
for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(m))) {
  try {
    const r = m as unknown as Record<string, unknown>;
    console.log(k, typeof r[k]);
  } catch {
    // ignore
  }
}

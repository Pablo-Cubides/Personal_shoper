import * as ga from '@google/generative-ai';

console.log('exports:', Object.keys(ga));
const G = ga as unknown as Record<string, unknown>;
for (const k of Object.keys(ga)) {
  try {
    console.log(k, typeof G[k]);
  } catch {
    // ignore introspection errors
  }
}

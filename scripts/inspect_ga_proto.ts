import { GoogleGenerativeAI } from '@google/generative-ai';

const G = GoogleGenerativeAI;
if (!G) {
  console.log('GoogleGenerativeAI not found');
} else {
  console.log('GoogleGenerativeAI prototype methods:');
  console.log(Object.getOwnPropertyNames(G.prototype));
  for (const k of Object.getOwnPropertyNames(G.prototype)) {
    try {
      const proto = G.prototype as unknown as Record<string, unknown>;
      console.log(k, typeof proto[k]);
    } catch {
      // ignore
    }
  }
}

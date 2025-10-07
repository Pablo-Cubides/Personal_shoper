import { GoogleGenerativeAI } from '@google/generative-ai';

(async () => {
  try {
    console.log('ga keys:', Object.keys(GoogleGenerativeAI));
  const G = GoogleGenerativeAI;
  if (!G) return console.log('GoogleGenerativeAI not found');
  const client = new G(process.env.GOOGLE_API_KEY || '');
    console.log('client created:', client && typeof client);
    const modelName = process.env.GOOGLE_IMAGE_MODEL || 'generative-image-1';
    console.log('modelName', modelName);
  let model: unknown = null
    try {
      model = await client.getGenerativeModel({ model: modelName })
      } catch (e: unknown) { console.error('getGenerativeModel error', e instanceof Error ? e.message : String(e)); model = null }
    console.log('model:', model && (typeof model));
    if (model) {
      const props = Object.getOwnPropertyNames(Object.getPrototypeOf(model));
      console.log('model prototype props:', props);
      for (const p of props) {
        // accessing prototype properties may throw in exotic cases; guard with typeof
        try {
          const asObj = model as Record<string, unknown>;
          const val = asObj ? (asObj[p] as unknown) : undefined;
          console.log(p, typeof val)
        } catch {
          console.log(p, 'error accessing')
        }
      }
    }
  } catch (e: unknown) {
    console.error('error', e instanceof Error ? e.message : String(e));
  }
})();

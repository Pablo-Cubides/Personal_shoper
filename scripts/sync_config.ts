import fs from 'fs';
import path from 'path';

const mdPath = path.join(process.cwd(), 'AI_CONFIG.md');
const outPath = path.join(process.cwd(), 'ai_config.json');

function extractJsonBlock(md: string): string | null {
  const re = /```json([\s\S]*?)```/i;
  const m = md.match(re);
  if (!m) return null;
  return m[1].trim();
}

try {
  const md = fs.readFileSync(mdPath, 'utf8');
  const jsonBlock = extractJsonBlock(md);
  if (!jsonBlock) {
    console.error('No JSON block found in AI_CONFIG.md');
    process.exit(1);
  }
  const obj = JSON.parse(jsonBlock);
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), 'utf8');
  console.log('Wrote ai_config.json');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('sync_config error', msg);
  process.exit(1);
}

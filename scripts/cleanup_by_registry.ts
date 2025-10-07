import { promises as fs } from 'fs';
import path from 'path';
import { deleteFromStorage } from '../lib/storage';

async function run(hours: number) {
  const registryPath = path.join(process.cwd(), 'data', 'generated_images.json');
  try {
    const txt = await fs.readFile(registryPath, 'utf8');
    const arr = JSON.parse(txt || '[]') as unknown;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const keep: unknown[] = [];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const createdAt = (item as any)?.createdAt; // createdAt may be number
        if (!createdAt || (typeof createdAt === 'number' && createdAt < cutoff)) {
          try {
            console.log('Removing', (item as any)?.publicId || (item as any)?.url);
            await deleteFromStorage((item as any)?.publicId || (item as any)?.url);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('Delete error', msg);
          }
        } else {
          keep.push(item);
        }
      }
    }
    await fs.writeFile(registryPath, JSON.stringify(keep, null, 2), 'utf8');
    console.log('Cleanup finished, kept', keep.length);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('cleanup_by_registry error', msg);
    process.exit(1);
  }
}

const hrs = parseInt(process.argv[2], 10) || 24;
run(hrs);

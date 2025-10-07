
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

import { mapUserTextToIntent } from '../lib/ai/gemini'

// Try to detect whether BASE_URL is reachable. If not, skip heavy integration tests.
const httpBase = process.env.BASE_URL || 'http://localhost:3000';

async function isBaseReachable(base: string): Promise<boolean> {
  try {
    const res = await axios.get(base, { timeout: 1000 }).catch(() => null)
    return !!res
  } catch {
    return false
  }
}

// Helper to start next (build + start) for tests. Returns the spawned process.
async function startNextForTests(port = 3001): Promise<{ proc: ChildProcess; base: string } | null> {
  const base = `http://localhost:${port}`
  // Run build first
  await new Promise((resolve, reject) => {
    const b = spawn('npm', ['run', 'build'], { shell: true, stdio: 'inherit' })
    b.on('exit', (code) => {
      if (code === 0) resolve(null)
      else reject(new Error('build failed with code ' + code))
    })
    b.on('error', reject)
  }).catch((e) => { throw e })

  // Start next in production mode
  const proc = spawn('npx', ['next', 'start', '-p', String(port)], { shell: true, stdio: 'inherit' })

  // wait for server to become reachable
  const start = Date.now()
  const timeout = 30_000
  while (Date.now() - start < timeout) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isBaseReachable(base)
    if (ok) return { proc, base }
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 500))
  }

  // If we get here, kill the process and return null
  try { proc.kill() } catch {}
  return null
}

describe('Unified tests (unit + integration guard)', () => {
  const filePath = path.join(__dirname, '..', 'public', 'uploads', 'imagen_prueba_din.jpg');
  let imageUrl: string;
  let publicId: string;
  let integration = false
  let serverProc: ChildProcess | null = null
  let httpBaseLocal = process.env.BASE_URL || 'http://localhost:3000'

  beforeAll(async () => {
    // Try to reach configured base first
    integration = await isBaseReachable(process.env.BASE_URL || httpBaseLocal)
    if (!integration) {
      // Attempt to start a local next server for E2E tests
      const started = await startNextForTests(3001).catch(() => null)
      if (started && started.base) {
        serverProc = started.proc
        httpBaseLocal = started.base
        process.env.BASE_URL = httpBaseLocal
        integration = true
      }
    }
  }, 120000)

  afterAll(async () => {
    if (serverProc) {
      try { serverProc.kill() } catch {}
    }
  })

  // Unit test: map user text to intent (always runs)
  describe('Intent parsing (unit)', () => {
    it('parses basic requests', () => {
      const r = mapUserTextToIntent('Quiero el cabello más corto y una barba stubble', 'es')
      expect(r.change.some(c => c.type === 'hair_length' && c.value === 'short')).toBe(true)
      expect(r.change.some(c => c.type === 'beard_style' && c.value === 'stubble')).toBe(true)
    })
  })

  // Integration tests: only run if server reachable
  if (!integration) {
    describe.skip('Integration tests (server not reachable)', () => {
      it('skipping integration tests because server is not reachable at ' + httpBase, () => {})
    })
  } else {
    describe('API Endpoints (integration)', () => {
  beforeAll(async () => {
        // Upload image once for all tests
        const fd = new FormData();
        fd.append('file', fs.createReadStream(filePath));

        const upResponse = await axios.post(`${httpBase}/api/upload`, fd, { headers: fd.getHeaders() });
        imageUrl = upResponse.data.imageUrl;
        publicId = upResponse.data.publicId;
      });

      describe('POST /api/upload', () => {
        it('should upload an image and return the image URL and public ID', () => {
          expect(typeof imageUrl).toBe('string');
          expect(typeof publicId).toBe('string');
        });

        it('should return a 400 error if no file is provided', async () => {
          const fd = new FormData();
          try {
              await axios.post(`${httpBase}/api/upload`, fd, { headers: fd.getHeaders() });
            } catch (error) {
              const err = error as unknown;
              let status: number | undefined = undefined;
              if (err && typeof err === 'object' && 'response' in err) {
                const asObj = err as Record<string, unknown>;
                if (asObj.response && typeof asObj.response === 'object' && 'status' in (asObj.response as Record<string, unknown>)) {
                  status = (asObj.response as Record<string, unknown>).status as unknown as number;
                }
              }
              expect(status).toBe(400);
            }
        });
      });

      describe('POST /api/analyze', () => {
        it('should analyze an image and return the analysis results', async () => {
          const anResponse = await axios.post(`${httpBase}/api/analyze`, { imageUrl });
          expect(anResponse.status).toBe(200);
          const anData = anResponse.data;
          expect(anData).toHaveProperty('analysis');
          expect(typeof anData.analysis.faceOk).toBe('boolean');
        });
      });

      describe('POST /api/iterate', () => {
        it('should iterate on an image and return the new image URL and public ID', async () => {
          const itResponse = await axios.post(`${httpBase}/api/iterate`, {
            originalImageUrl: imageUrl,
            userText: 'Quiero el pelo mas corto',
            prevPublicId: publicId,
          });
          expect(itResponse.status).toBe(200);
          const itData = itResponse.data;
          expect(typeof itData.editedUrl).toBe('string');
          expect(typeof itData.publicId).toBe('string');
        });
      });

      describe('POST /api/moderate', () => {
        it('should moderate an image and return the moderation results', async () => {
          const modResponse = await axios.post(`${httpBase}/api/moderate`, { imageUrl });
          expect(modResponse.status).toBe(200);
          const modData = modResponse.data;
          expect(modData).toHaveProperty('moderation');
          expect(typeof modData.moderation.flagged).toBe('boolean');
        });
      });
    })
  }
})

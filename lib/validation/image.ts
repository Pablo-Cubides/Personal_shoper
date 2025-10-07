import { APP_CONFIG } from '../config/app.config';
import { ValidationError } from '../errors';
import { appendLog } from '../ai/logger';
import * as nodeCrypto from 'crypto';

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  };
}

type FetchLike = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

async function getFetchImplementation(): Promise<FetchLike> {
  try {
    const mod = await import('node-fetch');
    // node-fetch exports the fetch function as default in some versions
    const maybeDefault = (mod as unknown) && (mod as unknown as { default?: unknown }).default
    if (maybeDefault && typeof maybeDefault === 'function') return maybeDefault as FetchLike;
    if (typeof (mod as unknown) === 'function') return (mod as unknown) as FetchLike;
  } catch {
    // fallback to global fetch
  }

  if (typeof globalThis.fetch === 'function') return globalThis.fetch as FetchLike;

  throw new Error('No fetch implementation available');
}

type FetchHeadersLike = {
  get?: (k: string) => string | null | undefined;
} & Record<string, unknown>;

function readHeader(headers: unknown, key: string): string | undefined {
  if (!headers) return undefined;
  // If headers has a get() method (like Headers), call it
  if (typeof headers === 'object' && headers !== null) {
    const h = headers as FetchHeadersLike;
    if (typeof h.get === 'function') {
      const v = h.get(key);
      return typeof v === 'string' ? v : undefined;
    }

    // Otherwise try to read as a plain object
    const asObj = headers as Record<string, unknown>;
    const candidate = asObj[key as string];
    if (typeof candidate === 'string') return candidate;
  }

  return undefined;
}

async function validateImageBuffer(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    const probe = await import('probe-image-size');
    const dimensions = probe.default.sync(buffer);

    if (!dimensions) return { valid: false, error: 'Unable to read image metadata. File may be corrupted.' };

    const { width, height, type, length } = dimensions;

    if (width < APP_CONFIG.images.MIN_WIDTH || height < APP_CONFIG.images.MIN_HEIGHT) {
      return { valid: false, error: `Image too small. Minimum size: ${APP_CONFIG.images.MIN_WIDTH}x${APP_CONFIG.images.MIN_HEIGHT}px`, details: { width, height, format: type, size: length } };
    }

    if (width > APP_CONFIG.images.MAX_WIDTH || height > APP_CONFIG.images.MAX_HEIGHT) {
      return { valid: false, error: `Image too large. Maximum size: ${APP_CONFIG.images.MAX_WIDTH}x${APP_CONFIG.images.MAX_HEIGHT}px`, details: { width, height, format: type, size: length } };
    }

    return { valid: true, details: { width, height, format: type, size: length } };
  } catch (err) {
    return { valid: false, error: `Failed to validate image: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function validateUploadedFile(file: File): Promise<ImageValidationResult> {
  const startTime = Date.now();

  try {
    const maxSizeMb = process.env.MAX_IMAGE_SIZE_MB ? parseInt(process.env.MAX_IMAGE_SIZE_MB, 10) : APP_CONFIG.images.MAX_FILE_SIZE_MB;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) return { valid: false, error: `File size exceeds ${APP_CONFIG.images.MAX_FILE_SIZE_MB}MB limit`, details: { size: file.size } };

    if (!APP_CONFIG.images.ALLOWED_TYPES.includes(file.type)) return { valid: false, error: `Invalid file type. Allowed types: ${APP_CONFIG.images.ALLOWED_TYPES.join(', ')}`, details: { format: file.type } };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await validateImageBuffer(buffer);

    appendLog({ phase: 'image.validation', valid: result.valid, error: result.error, details: result.details, durationMs: Date.now() - startTime, timestamp: Date.now() });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    appendLog({ phase: 'image.validation.error', error: errorMessage, durationMs: Date.now() - startTime, timestamp: Date.now() });
    return { valid: false, error: `Validation failed: ${errorMessage}` };
  }
}

export async function validateImageUrl(imageUrl: string): Promise<ImageValidationResult> {
  const startTime = Date.now();

  try {
    const fetchImpl = await getFetchImplementation();
    const response = await fetchImpl(String(imageUrl));

    if (!response.ok) return { valid: false, error: `Failed to fetch image: HTTP ${response.status}` };

    const contentType = readHeader(response.headers, 'content-type') || '';
    if (!APP_CONFIG.images.ALLOWED_TYPES.includes(contentType)) return { valid: false, error: `Invalid content type: ${contentType}. Expected: ${APP_CONFIG.images.ALLOWED_TYPES.join(', ')}` };

    const contentLengthRaw = readHeader(response.headers, 'content-length');
    if (contentLengthRaw) {
      const size = parseInt(contentLengthRaw, 10);
      const maxSizeBytes = APP_CONFIG.images.MAX_FILE_SIZE_MB * 1024 * 1024;
      if (size > maxSizeBytes) return { valid: false, error: `Image size exceeds ${APP_CONFIG.images.MAX_FILE_SIZE_MB}MB limit`, details: { size } };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await validateImageBuffer(buffer);

    appendLog({ phase: 'image.validation.url', imageUrl: APP_CONFIG.compliance.PRIVACY_MODE ? '[redacted]' : imageUrl, valid: result.valid, error: result.error, details: result.details, durationMs: Date.now() - startTime, timestamp: Date.now() });

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    appendLog({ phase: 'image.validation.url.error', imageUrl: APP_CONFIG.compliance.PRIVACY_MODE ? '[redacted]' : imageUrl, error: errorMessage, durationMs: Date.now() - startTime, timestamp: Date.now() });
    return { valid: false, error: `Failed to validate image URL: ${errorMessage}` };
  }
}

export async function enforceImageValidation(input: File | string): Promise<ImageValidationResult> {
  const result = typeof input === 'string' ? await validateImageUrl(input) : await validateUploadedFile(input);
  if (!result.valid) throw new ValidationError(result.error || 'Image validation failed', 'image', result.details);
  return result;
}

export function calculateImageHash(buffer: Buffer): string {
  return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
}

export async function getImageBuffer(imageUrl: string): Promise<Buffer> {
  const fetchImpl = await getFetchImplementation();
  const response = await fetchImpl(String(imageUrl));
  if (!response.ok) throw new Error(`Failed to fetch image: HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

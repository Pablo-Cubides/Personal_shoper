import type { BodyAnalysis, IteratePayload } from './types/ai';

// Define a generic error structure for API responses
export type ApiError = {
  error: string;
  message: string;
};

// Type for the successful upload response
export type UploadResponse = {
  imageUrl: string;
  sessionId: string;
  publicId: string;
};

// Type for the successful analysis response
export type AnalyzeResponse = {
  analysis: BodyAnalysis;
  workingUrl: string;
  cached: boolean;
};

// Type for the successful iteration response
export type IterateResponse = {
    editedUrl: string;
    publicId: string;
    note: string;
};


/**
 * A wrapper around fetch to handle common API call patterns, like JSON parsing and error handling.
 * @param url The URL to fetch.
 * @param options The fetch options.
 * @returns The parsed JSON response.
 * @throws An ApiError if the response is not ok.
 */
async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw data as ApiError;
  }
  return data as T;
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadResponse>('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function analyzeImage(imageUrl: string, locale: string = 'es'): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, locale }),
  });
}

export async function iterateEdit(payload: IteratePayload): Promise<IterateResponse> {
    return apiFetch<IterateResponse>('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

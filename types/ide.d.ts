// IDE helper: ensure editors pick up installed type packages and declare a few untyped modules
/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="next" />

// Keep only the cloudinary shim; other modules have @types
declare module 'next/navigation' {
  export * from 'next/navigation';
}

// Cloudinary: minimal shape used in the project (v2 API)
declare module 'cloudinary' {
  export const v2: {
    config(options?: { cloud_name?: string; api_key?: string; api_secret?: string }): void;
    uploader: {
      upload(path: string, options?: Record<string, unknown>): Promise<{ public_id: string; secure_url: string }>;
      destroy(publicId: string, options?: Record<string, unknown>): Promise<unknown>;
    };
  };
}

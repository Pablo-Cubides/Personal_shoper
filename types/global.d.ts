// Global and asset module declarations
/// <reference types="node" />
/// <reference types="react" />
/// <reference types="next" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg' {
  const content: string;
  export default content;
}

// Minimal typed shims for libraries without official @types in this project
// `form-data` and `streamifier` are covered by installed @types packages; keep specific shims removed.

// sharp was removed from the codebase. If you re-add it later, delete this comment and restore typings or install @types/sharp if available.

// Note: prefer installing official @types packages when available (for example `@types/node-fetch`).

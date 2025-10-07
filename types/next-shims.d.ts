declare module 'next/server' {
  export interface NextRequest {
    json(): Promise<unknown>;
    headers: Headers;
    cookies: Record<string, string>;
  }

  // Make NextResponse statically compatible with the standard Response type
  export const NextResponse: {
    json(data: unknown, init?: ResponseInit): Response;
    redirect(url: string, status?: number): Response;
    new (body?: BodyInit | null, init?: ResponseInit): Response;
  };

  export const headers: () => Headers;
  export const cookies: () => Record<string, string>;
}

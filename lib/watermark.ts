export async function applyWatermark(buffer: Buffer) {
  // Watermarking removed to avoid dependency on native image libs.
  // If you want watermarking in the future, reintroduce a library
  // (for example sharp) or use an external image processing service.
  return buffer
}

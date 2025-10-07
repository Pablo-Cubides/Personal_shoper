export async function trackEvent(name: string, payload: Record<string, unknown>) {
  console.log('track', name, payload)
}

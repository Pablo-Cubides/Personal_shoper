import fetch from 'node-fetch';

async function main() {
  const url = process.env.BASE_URL || 'http://localhost:3000';
  const res = await fetch(url + '/api/iterate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ originalImageUrl: 'https://example.com/not-used.jpg', userText: 'test', sessionId: 'test-session' })
  });
  console.log('status', res.status);
  const body = await res.text();
  try {
    console.log('body', JSON.parse(body));
  } catch {
    console.log('body (raw)', body);
  }
  if (res.status === 503) {
    console.log('OK: iterate returned 503 as expected');
    process.exit(0);
  }
  console.error('FAIL: expected 503, got', res.status);
  process.exit(2);
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e : String(e)); process.exit(1) });

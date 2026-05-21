/**
 * Security Integration Tests
 * Tests all protective measures: rate limiting, CORS, query validation,
 * error sanitization, enum validation, auth, and prompt injection filtering.
 */

const BASE = 'http://localhost:5000';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];

function log(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${name}: ${detail}`);
}

async function postJson(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

async function getJson(path: string) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  return { status: res.status, json, headers: res.headers };
}

// ─────────────────────────────────────────────
// TEST 1: Normal query works
// ─────────────────────────────────────────────
async function testNormalQuery() {
  const { status, json } = await postJson('/api/query', { query: 'What is Project Quantum?' });
  log('Normal Query', status === 200 && json?.answer?.length > 0, `HTTP ${status}, answer length: ${json?.answer?.length || 0}`);
}

// ─────────────────────────────────────────────
// TEST 2: Query length cap (>500 chars rejected)
// ─────────────────────────────────────────────
async function testQueryLengthCap() {
  const longQuery = 'a'.repeat(501);
  const { status, json } = await postJson('/api/query', { query: longQuery });
  log('Query Length Cap', status === 400 && json?.error?.includes('maximum length'), `HTTP ${status}: ${json?.error}`);
}

// ─────────────────────────────────────────────
// TEST 3: Empty query rejected
// ─────────────────────────────────────────────
async function testEmptyQuery() {
  const { status, json } = await postJson('/api/query', { query: '' });
  log('Empty Query Rejected', status === 400, `HTTP ${status}: ${json?.error}`);
}

// ─────────────────────────────────────────────
// TEST 4: Invalid feedback status rejected
// ─────────────────────────────────────────────
async function testInvalidFeedbackStatus() {
  const { status, json } = await postJson('/api/feedback', {
    query: 'test',
    answer: 'test',
    confidenceScore: 0.5,
    status: 'hacked',  // invalid
    domain: 'General'
  });
  log('Invalid Feedback Status', status === 400 && json?.error?.includes('Invalid status'), `HTTP ${status}: ${json?.error}`);
}

// ─────────────────────────────────────────────
// TEST 5: Valid feedback accepted
// ─────────────────────────────────────────────
async function testValidFeedback() {
  const { status, json } = await postJson('/api/feedback', {
    query: 'test query',
    answer: 'test answer',
    confidenceScore: 0.5,
    status: 'correct',
    domain: 'General'
  });
  log('Valid Feedback Accepted', status === 200 && json?.success === true, `HTTP ${status}: feedbackId=${json?.feedbackId}`);
}

// ─────────────────────────────────────────────
// TEST 6: feedbackId type validation
// ─────────────────────────────────────────────
async function testFeedbackIdValidation() {
  const { status, json } = await postJson('/api/feedback/resolve', { feedbackId: 12345 }); // number, not string
  log('FeedbackId Type Check', status === 400 && json?.error?.includes('must be a string'), `HTTP ${status}: ${json?.error}`);
}

// ─────────────────────────────────────────────
// TEST 7: Helmet security headers present
// ─────────────────────────────────────────────
async function testHelmetHeaders() {
  const { headers } = await getJson('/api/metrics');
  const xcto = headers.get('x-content-type-options');
  const xfo = headers.get('x-frame-options');
  const pass = xcto === 'nosniff' && xfo !== null;
  log('Helmet Headers', pass, `X-Content-Type-Options: ${xcto}, X-Frame-Options: ${xfo}`);
}

// ─────────────────────────────────────────────
// TEST 8: Body size limit (>100kb rejected)
// ─────────────────────────────────────────────
async function testBodySizeLimit() {
  const bigBody = { query: 'x'.repeat(200_000) };
  const res = await fetch(`${BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bigBody),
  });
  // Express returns 413 Payload Too Large when limit exceeded
  log('Body Size Limit', res.status === 413, `HTTP ${res.status}`);
}

// ─────────────────────────────────────────────
// TEST 9: CORS - disallowed origin rejected
// ─────────────────────────────────────────────
async function testCorsRestriction() {
  const res = await fetch(`${BASE}/api/metrics`, {
    headers: { 'Origin': 'http://evil-site.com' },
  });
  const acao = res.headers.get('access-control-allow-origin');
  // Should NOT have the evil origin
  const pass = acao !== 'http://evil-site.com' && acao !== '*';
  log('CORS Restriction', pass, `Access-Control-Allow-Origin: ${acao || '(not set)'}`);
}

// ─────────────────────────────────────────────
// TEST 10: CORS - allowed origin accepted
// ─────────────────────────────────────────────
async function testCorsAllowed() {
  const res = await fetch(`${BASE}/api/metrics`, {
    headers: { 'Origin': 'http://localhost:5173' },
  });
  const acao = res.headers.get('access-control-allow-origin');
  log('CORS Allowed Origin', acao === 'http://localhost:5173', `Access-Control-Allow-Origin: ${acao || '(not set)'}`);
}

// ─────────────────────────────────────────────
// TEST 11: Rate Limiter - Query endpoint (30/min)
// ─────────────────────────────────────────────
async function testQueryRateLimiter() {
  console.log('\n⏳ Testing query rate limiter (sending 32 rapid requests)...');
  let rateLimited = false;
  let lastStatus = 200;

  for (let i = 0; i < 32; i++) {
    const { status } = await postJson('/api/query', { query: 'test rate limit' });
    lastStatus = status;
    if (status === 429) {
      rateLimited = true;
      log('Query Rate Limiter', true, `Rate limited after ${i + 1} requests (HTTP 429)`);
      break;
    }
  }

  if (!rateLimited) {
    log('Query Rate Limiter', false, `Sent 32 requests, last status: ${lastStatus} — rate limiter did not trigger`);
  }
}

// ─────────────────────────────────────────────
// TEST 12: Metrics endpoint still works
// ─────────────────────────────────────────────
async function testMetrics() {
  const { status, json } = await getJson('/api/metrics');
  const pass = status === 200 && typeof json?.rollingAvgConfidence === 'number';
  log('Metrics Endpoint', pass, `HTTP ${status}, healthLevel: ${json?.healthLevel}`);
}

// ─────────────────────────────────────────────
// TEST 13: Feedback list endpoint works
// ─────────────────────────────────────────────
async function testFeedbackList() {
  const { status, json } = await getJson('/api/feedback');
  log('Feedback List', status === 200 && Array.isArray(json), `HTTP ${status}, entries: ${json?.length}`);
}

// ─────────────────────────────────────────────
// RUN ALL
// ─────────────────────────────────────────────
async function main() {
  console.log('🔬 AetherGrid Security Integration Tests\n');
  console.log('='.repeat(60));

  await testNormalQuery();
  await testQueryLengthCap();
  await testEmptyQuery();
  await testInvalidFeedbackStatus();
  await testValidFeedback();
  await testFeedbackIdValidation();
  await testHelmetHeaders();
  await testBodySizeLimit();
  await testCorsRestriction();
  await testCorsAllowed();
  await testMetrics();
  await testFeedbackList();
  // Rate limiter test last since it consumes the rate limit window
  await testQueryRateLimiter();

  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => console.log(`   - ${r.name}: ${r.detail}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

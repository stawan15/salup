import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, getClientKey, validateSummaryInput } from '../api/summarize-utils.js';

test('rate limiter allows the configured number of requests and blocks the next one', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.check('user').allowed, true);
  assert.equal(limiter.check('user').allowed, true);
  assert.equal(limiter.check('user').allowed, false);
  assert.equal(limiter.check('other').allowed, true);
});

test('client key uses the first forwarded address', () => {
  assert.equal(getClientKey({ headers: { 'x-forwarded-for': '203.0.113.4, 10.0.0.1' } }), '203.0.113.4');
});

test('summary input rejects oversized fields and accepts normal input', () => {
  assert.match(validateSummaryInput({ work: 'x'.repeat(12_001) }).error, /work/);
  const result = validateSummaryInput({ work: 'ตรวจงาน', entries: [], styleExamples: [] });
  assert.equal(result.value.work, 'ตรวจงาน');
});

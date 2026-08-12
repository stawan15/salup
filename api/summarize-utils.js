const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 10;

export function createRateLimiter({ limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS } = {}) {
  const requests = new Map();

  return {
    check(key) {
      const now = Date.now();
      const current = requests.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        requests.set(key, { startedAt: now, count: 1 });
        return { allowed: true, remaining: limit - 1, retryAfter: 0 };
      }
      if (current.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil((windowMs - (now - current.startedAt)) / 1000),
        };
      }
      current.count += 1;
      return { allowed: true, remaining: limit - current.count, retryAfter: 0 };
    },
  };
}

export function getClientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  return String(forwarded || req.headers?.['x-real-ip'] || 'unknown').split(',')[0].trim() || 'unknown';
}

export function validateSummaryInput(body = {}) {
  const input = body || {};
  const work = String(input.work || '');
  const blocker = String(input.blocker || '');
  const next = String(input.next || '');
  const entries = Array.isArray(input.entries) ? input.entries : [];
  const styleExamples = Array.isArray(input.styleExamples) ? input.styleExamples : [];
  const limits = [
    ['work', work, 12_000],
    ['blocker', blocker, 4_000],
    ['next', next, 4_000],
  ];
  const exceeded = limits.find(([, value, max]) => value.length > max);
  if (exceeded) return { error: `${exceeded[0]} ยาวเกินกำหนด (${exceeded[2].toLocaleString()} ตัวอักษร)` };
  if (entries.length > 30) return { error: 'ข้อมูลรายสัปดาห์มีมากเกินไป' };
  if (styleExamples.length > 5) return { error: 'ตัวอย่างสำนวนมีมากเกินไป' };
  return { value: { ...input, work, blocker, next, entries, styleExamples } };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataClient } from '../public/modules/data.js';

test('data client returns a clear error when auth is unavailable', async () => {
  const data = createDataClient({ getClient: () => null, getUser: () => null });
  const result = await data.saveToSupabase({ work: 'ทดสอบ', summary: '<p>ทดสอบ</p>' });
  assert.equal(result.error.message, 'ยังไม่ได้เข้าสู่ระบบ');
});

test('data client scopes rating updates to the current user', async () => {
  const calls = [];
  const query = {
    update(payload) { calls.push(['update', payload]); return this; },
    eq(field, value) { calls.push(['eq', field, value]); return this; },
  };
  const client = { from(table) { calls.push(['from', table]); return query; } };
  const data = createDataClient({ getClient: () => client, getUser: () => ({ id: 'user-1' }) });
  await data.updateRemoteRating('entry-1', 5, 'เป็นธรรมชาติ');
  assert.deepEqual(calls, [
    ['from', 'work_logs'],
    ['update', { ai_rating: 5, ai_feedback: 'เป็นธรรมชาติ' }],
    ['eq', 'id', 'entry-1'],
    ['eq', 'user_id', 'user-1'],
  ]);
});

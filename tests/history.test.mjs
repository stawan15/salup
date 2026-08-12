import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHistoryEntries, renderHistoryMarkup } from '../public/modules/history.js';

const entries = [
  { createdAt: '1', title: 'รายงาน QA', plainSummary: 'ตรวจระบบ', format: 'report', category: 'พัฒนาและทดสอบ', feedback: '' },
  { createdAt: '2', title: 'คุยงาน', plainSummary: 'ประสานงานทีม', format: 'chat', category: 'ประสานงาน', feedback: '' },
];

test('history filters by format, category, and search text', () => {
  assert.equal(filterHistoryEntries(entries, { format: 'report' }).length, 1);
  assert.equal(filterHistoryEntries(entries, { category: 'ประสานงาน' })[0].createdAt, '2');
  assert.equal(filterHistoryEntries(entries, { search: 'qa' })[0].createdAt, '1');
});

test('history markup includes labels and safe escaped content', () => {
  const markup = renderHistoryMarkup([{ ...entries[0], title: '<script>alert(1)</script>' }], () => '★');
  assert.match(markup, /บทรายงาน/);
  assert.doesNotMatch(markup, /<script>/);
});

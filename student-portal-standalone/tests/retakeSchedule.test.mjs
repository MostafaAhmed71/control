import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRetakeRange, isRetakeDayAllowed, selectedRetakeDate } from '../src/retakeSchedule.js';

const schedule = { startDate: '2026-10-18', endDate: '2026-10-22', time: '08:00', isOpen: true };
for (const day of ['2026-10-18', '2026-10-20', '2026-10-22']) {
  assert.equal(isRetakeDayAllowed(schedule, day), true);
  assert.equal(selectedRetakeDate(schedule, day), `${day}T08:00:00+03:00`);
}
for (const day of ['', '2026-10-17', '2026-10-23', '2026-02-30', 'invalid']) {
  assert.throws(() => selectedRetakeDate(schedule, day));
}
assert.throws(() => selectedRetakeDate({ ...schedule, isOpen: false }, '2026-10-20'));
assert.throws(() => selectedRetakeDate({ ...schedule, endDate: '2026-10-17' }, '2026-10-20'));
assert.throws(() => selectedRetakeDate({ ...schedule, time: '25:00' }, '2026-10-20'));
assert.throws(() => selectedRetakeDate(undefined, '2026-10-20'));
assert.deepEqual(getRetakeRange({ date: '2026-10-18' }), { startDate: '2026-10-18', endDate: '2026-10-18' });
assert.equal(selectedRetakeDate({ date: '2026-10-18' }, '2026-10-18'), '2026-10-18T08:00:00+03:00');

// Exercise the real request flow with an isolated database double; never write student data.
let currentSchedule = schedule;
let inserted = [];
globalThis.__retakeTestDb = {
  from(table) {
    if (table === 'settings') return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: { retakeSchedule: currentSchedule } } } ) }) }) };
    assert.equal(table, 'retake_requests');
    return { insert(row) { inserted.push(row.data); return { select: () => ({ single: async () => ({ data: { id: 'test', created_at: 'now' } }) }) }; } };
  },
};
let source = await readFile(new URL('../src/dataService.js', import.meta.url), 'utf8');
source = source.replace("'./retakeSchedule'", JSON.stringify(new URL('../src/retakeSchedule.js', import.meta.url).href))
  .replace("import { createClient } from '@supabase/supabase-js';", 'const createClient = () => globalThis.__retakeTestDb;')
  .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://example.test'")
  .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test'");
const { requestRetake } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const result = await requestRetake({ studentName: 'Test' }, '2026-10-20');
assert.equal(result.scheduledDate, '2026-10-20T08:00:00+03:00');
assert.equal(inserted.length, 1);
currentSchedule = { ...schedule, isOpen: false };
await assert.rejects(requestRetake({}, '2026-10-20'));
currentSchedule = { ...schedule, endDate: '2026-10-19' };
await assert.rejects(requestRetake({}, '2026-10-20'));
currentSchedule = undefined;
await assert.rejects(requestRetake({}, '2026-10-20'));
assert.equal(inserted.length, 1);
delete globalThis.__retakeTestDb;
console.log('Retake range and request persistence tests passed.');

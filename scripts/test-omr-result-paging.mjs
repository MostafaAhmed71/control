import assert from 'node:assert/strict';
import { fetchOmrResultPages } from '../src/utils/omrResultPaging.js';

function mockClient(records, fail) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'omr_results');
      const call = { cursor: null };
      const query = {
        select(value) { assert.equal(value, 'id, data'); return this; },
        order(column, options) { assert.equal(column, 'id'); assert.equal(options.ascending, true); return this; },
        limit(value) { call.limit = value; return this; },
        eq(column, value) { assert.equal(column, 'data->>examId'); call.examId = value; return this; },
        gt(column, value) { assert.equal(column, 'id'); call.cursor = value; return this; },
        then(resolve) {
          calls.push({ ...call });
          const error = fail?.(call, calls.length);
          return Promise.resolve(error ? { error, status: error.status || 500 } : {
            data: records.filter((row) => (call.cursor === null || row.id > call.cursor)
              && (!call.examId || row.data.examId === call.examId)).slice(0, call.limit),
          }).then(resolve);
        },
      };
      return query;
    },
  };
}

const records = Array.from({ length: 27 }, (_, i) => ({ id: i + 1, data: { id: `payload-${i}`, score: i, systemViewImage: 'data:image/jpeg;base64,keep-image' } }));
const client = mockClient(records, (call) => call.cursor === 10 && call.limit > 2 ? { code: '57014', message: 'canceling statement due to statement timeout' } : null);
const rows = await fetchOmrResultPages(client, { sleep: async () => {} });
assert.equal(rows.length, records.length);
assert.deepEqual(rows.map((row) => row.score), records.map((row) => row.data.score));
assert.ok(rows.every((row) => row.systemViewImage === records[0].data.systemViewImage));
assert.deepEqual(client.calls.filter((call) => call.cursor === 10).map((call) => call.limit), [10, 5, 2]);
assert.equal(new Set(rows.map((row) => row.id)).size, 27);
const denied = mockClient(records, () => ({ status: 403, code: '42501', message: 'permission denied' }));
await assert.rejects(fetchOmrResultPages(denied, { sleep: async () => {} }), /permission denied/);
assert.equal(denied.calls.length, 1);
const failed = mockClient(records, (call) => call.cursor ? { code: '57014', message: 'timeout' } : null);
await assert.rejects(fetchOmrResultPages(failed, { sleep: async () => {} }), /timeout/);
const capped = await fetchOmrResultPages(mockClient(records), { maxRows: 13, sleep: async () => {} });
assert.equal(capped.length, 13);
assert.deepEqual(await fetchOmrResultPages(mockClient([])), []);
console.log('OMR pagination passed: timeout recovery, full images preserved, no missing or duplicate records, permissions and incomplete loads handled.');
const scopedClient = mockClient(records.map((row, i) => ({ ...row, data: { ...row.data, examId: i % 2 ? 'exam-b' : 'exam-a' } })));
const scoped = await fetchOmrResultPages(scopedClient, { examId: 'exam-a', pageSize: 3, sleep: async () => {} });
assert.equal(scoped.length, 14);
assert.ok(scoped.every((row) => row.examId === 'exam-a'));
assert.ok(scopedClient.calls.every((call) => call.examId === 'exam-a'));
console.log('Exam filter passed on every page: unrelated exam results are excluded.');

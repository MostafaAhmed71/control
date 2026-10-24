import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/dataService.js', import.meta.url), 'utf8');
let savedScore = 1;
let queries = 0;
const record = () => ({ id: 'approved-1', data: { studentId: '1234', nationalId: '1234', examId: 'exam1', examTitle: 'علوم', approved: true, score: savedScore, total: 10, percentage: savedScore * 10, answers: { 1: 'B' } } });
globalThis.__portalGradeTestDb = {
  from(table) {
    assert.equal(table, 'omr_results');
    return {
      select() { return {
        eq() { return { limit: async () => { queries++; return { data: [record()], error: null }; } }; },
        in: async () => ({ data: [{ id: 'approved-1', details: { 1: { student_answer: 'B', correct_option: 'A', is_correct: false } } }], error: null }),
      }; },
    };
  },
};
const serviceSource = source
  .replace(/^import .* from '\.\/retakeSchedule';/m, 'const getRetakeRange = () => ({}); const isDateKey = () => true; const selectedRetakeDate = () => "";')
  .replace("import { createClient } from '@supabase/supabase-js';", 'const createClient = () => globalThis.__portalGradeTestDb;')
  .replaceAll('import.meta.env.VITE_SUPABASE_URL', "'https://test.invalid'")
  .replaceAll('import.meta.env.VITE_SUPABASE_ANON_KEY', "'test'");
const { fetchOmrResultsForPortalLookup, hydrateOmrResultsDetails } = await import(`data:text/javascript;base64,${Buffer.from(serviceSource).toString('base64')}`);
const before = await fetchOmrResultsForPortalLookup('1234', { id: '1234' });
assert.equal(before.rows[0].score, 1);
savedScore = 9; // Simulates a confirmed grade edit in control, without changing scan answers.
const after = await fetchOmrResultsForPortalLookup('1234', { id: '1234' });
assert.equal(after.rows[0].score, 9, 'Repeated lookup must bypass old grade cache');
assert.ok(queries >= 8, 'Each lookup should query the database indexes');
const hydrated = await hydrateOmrResultsDetails(after.rows);
assert.equal(hydrated[0].score, 9);
assert.equal(hydrated[0].details[1].is_correct, false);

// Execute the actual search handler, including its background hydration callback.
// Inject network/UI dependencies rather than mounting React or touching student data.
const portal = await readFile(new URL('../src/StudentPortal.jsx', import.meta.url), 'utf8');
const start = portal.indexOf('  const handleSearch = async (e) => {') + '  const handleSearch = async (e) => {'.length;
const end = portal.indexOf('\n  /* ── Filtered results', start);
const body = portal.slice(start, end).replace(/\n  };\s*$/, '');
const gradingSource = await readFile(new URL('../src/omrGrading.js', import.meta.url), 'utf8');
const { applyExamKeysToResults } = await import(`data:text/javascript;base64,${Buffer.from(gradingSource).toString('base64')}`);
const rendered = [];
const deps = {
  studentId: '1234', setLoading() {}, setError(message) { if (message) throw new Error(message); }, setAllResults(value) { if (value) rendered.push(value); },
  setFilterText() {}, setExamGroup() {}, setSearchedStudent() {}, setMyRetakes() {}, setSearchProgress() {},
  normalizeNationalId: value => String(value || ''),
  findStudentByNormalizedNationalId: async () => ({ id: '1234', nationalId: '1234', name: 'Test Student' }),
  fetchOmrResultsForPortalLookup: async () => after,
  getOmrExamsPortalCached: async () => [{ id: 'exam1', title: 'علوم', keys: { 1: 'A' } }],
  getStudentsCached: async () => [], examIsArchived: () => false,
  buildSeatStudentMap: () => new Map(), studentNationalIdNorms: s => [s.nationalId],
  collectStudentIdentityNorms: () => new Set(['1234']), isApprovedOmrResult: () => true,
  resolveStudentFromResultRow: () => null, getPortalExamGroup: () => 'period1',
  parseResultDate: () => null, dedupeStudentResults: rows => rows,
  getMyRetakeRequests: async () => [], hydrateOmrResultsDetails,
  applyExamKeysToResults, supabaseUrl: 'https://test.invalid',
};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(...Object.keys(deps), 'e', body)(...Object.values(deps), { preventDefault() {} });
await new Promise(resolve => setImmediate(resolve));
assert.equal(rendered.length, 2, 'Verify both initial and hydrated results');
for (const rows of rendered) {
  assert.equal(rows[0].score, 9, 'Original scan answers must never replace the approved edited grade');
  assert.equal(Number(rows[0].percentage), 90);
  assert.equal(rows[0].total, 10);
}
delete globalThis.__portalGradeTestDb;
console.log('PASS: repeat lookup reads corrected score; initial and hydrated portal results preserve control grade.');

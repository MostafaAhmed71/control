import assert from 'node:assert/strict';
import { OMR_LAYOUT, browserOmrQuestionRows, browserOmrQrPayload } from '../src/browserOmrSheet.js';

const student = { id: 'student-db-id', national_id: '1000000000' };
assert.deepEqual(JSON.parse(browserOmrQrPayload(student, { template: 'custom:123', num_questions: 30, exam_id: 'chemistry-3' })), { id: '1000000000', nq: 30, tpl: 'custom', ex: 'chemistry-3' });
assert.equal(JSON.parse(browserOmrQrPayload(student, { template: 'nafs', num_questions: 20 })).tpl, 'nafs');
// These centers are consumed by the existing Python scanner.
const rows = browserOmrQuestionRows(30);
assert.equal(rows.length, 30);
assert.equal(rows[0].y, 1044);
assert.equal(rows[14].y, 2654);
assert.equal(rows[15].y, 1044);
assert.deepEqual(rows[0].bubbles.map((bubble) => bubble.x), [2200, 2060, 1920, 1780]);
assert.deepEqual(rows[15].bubbles.map((bubble) => bubble.x), [1080, 940, 800, 660]);
assert.equal(OMR_LAYOUT.width, 2481);
assert.equal(OMR_LAYOUT.height, 3507);
assert.equal(OMR_LAYOUT.qrX, 1981);
const forty = browserOmrQuestionRows(40);
assert.ok(forty[19].y + 42 < OMR_LAYOUT.signatureY);
assert.throws(() => browserOmrQuestionRows(0));
assert.throws(() => browserOmrQuestionRows(100));
console.log('Browser OMR geometry and QR identity compatibility checks passed.');

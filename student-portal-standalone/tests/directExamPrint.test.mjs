import assert from 'node:assert/strict';
import { prepareDirectExamBatches, matchesPrintScope, activePrintExams } from '../src/directExamPrintData.js';

const students = [
  { id: 'student-1', name: 'طالب تجريبي', nationalId: '1000000000', grade: 'الثالث الثانوي', seatNumber: '123' },
  { id: 'student-2', name: 'طالب تجريبي', nationalId: '2000000000', grade: 'الأول الثانوي', seatNumber: '124' },
];
const exams = [
  { id: 'chemistry', subject: 'كيمياء', title: 'كيمياء - الثالث الثانوي', stage: 'ثانوي', grades: ['الثالث الثانوي'], template: 'custom:chemistry', template_config: { school_name: 'مدرسة تجريبية', show_date_row: false }, qCount: 20 },
  { id: 'physics', subject: 'فيزياء', title: 'فيزياء - الثالث الثانوي', stage: 'ثانوي', grade: 'الثالث الثانوي', template: 'nafs', qCount: 30 },
  { id: 'first-grade', subject: 'فيزياء', stage: 'ثانوي', grade: 'الأول الثانوي', template: 'nafs' },
  { id: 'archived', subject: 'كيمياء', stage: 'ثانوي', grade: 'الثالث الثانوي', archived: 'true' },
];
const input = { studentId: 'student-1', stage: 'ثانوي', grade: 'الثالث الثانوي', examIds: ['chemistry', 'physics'], day: '2026-10-19', exams, students, settings: { retakeSchedule: { isOpen: false } } };
const before = JSON.stringify(input);
const jobs = prepareDirectExamBatches(input);
assert.equal(jobs.length, 2);
assert.deepEqual(jobs.map((job) => job.body.exam_id), ['chemistry', 'physics']);
assert.deepEqual(jobs.map((job) => job.body.num_questions), [20, 30]);
assert.equal(jobs[0].endpoint, '/generate-custom-batch');
assert.equal(jobs[0].body.template_config.show_date_row, false);
assert.equal(jobs[1].endpoint, '/generate-batch');
for (const job of jobs) {
  assert.equal(job.body.students.length, 1);
  assert.equal(job.body.students[0].national_id, students[0].nationalId);
  assert.equal(job.body.students[0].seat_number, '123');
  assert.equal(job.body.students[0].name, students[0].name);
}
assert.equal(JSON.stringify(input), before, 'Direct printing must not alter student, exam or request data');
assert.equal(matchesPrintScope({ grade: 'ثالث ثانوي' }, 'ثانوي', 'الثالث الثانوي'), true);
assert.equal(activePrintExams(exams).length, 3);
assert.throws(() => prepareDirectExamBatches({ ...input, studentId: 'student-2' }), /الطالب/);
assert.throws(() => prepareDirectExamBatches({ ...input, examIds: ['first-grade'] }), /الاختبارات/);
assert.throws(() => prepareDirectExamBatches({ ...input, examIds: ['archived'] }), /الاختبارات/);
assert.throws(() => prepareDirectExamBatches({ ...input, examIds: [] }), /اختر/);
assert.throws(() => prepareDirectExamBatches({ ...input, day: '2026-02-30' }), /تاريخ/);
assert.equal(prepareDirectExamBatches({ ...input, examIds: ['physics', 'physics'] }).length, 1);
console.log('Direct printing: multiple subjects, correct student and template, scope validation and no request changes passed.');

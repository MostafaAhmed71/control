import { prepareRetakeBatches } from './retakeExamExport.js';
import { isDateKey } from './retakeSchedule.js';

const text = (value) => String(value ?? '').trim();
const normalized = (value) => text(value).replace(/[أإآ]/g, 'ا').replace(/[\u064B-\u065Fـ]/g, '').replace(/\s+/g, ' ').split(' ').map((word) => word.startsWith('ال') ? word.slice(2) : word).join(' ');

export function examStage(value) {
  const stage = normalized(value);
  if (stage.includes('ابتدا')) return 'ابتدائي';
  if (stage.includes('متوسط')) return 'متوسط';
  if (stage.includes('ثانو')) return 'ثانوي';
  return text(value);
}

export function directExamGrades(exam) {
  return [...new Set((Array.isArray(exam.grades) && exam.grades.length ? exam.grades : [exam.grade]).map(text).filter(Boolean))];
}

export function matchesPrintScope(record, stage, grade = '') {
  const grades = directExamGrades(record);
  const stageMatch = examStage(record.stage || grades[0]) === stage;
  return stageMatch && (!grade || grades.some((item) => normalized(item) === normalized(grade)));
}

export function activePrintExams(exams) {
  return exams.filter((exam) => ![true, 1, '1', 'true'].includes(exam.archived));
}

function uniqueIds(values) {
  const ids = [];
  for (const value of values) {
    const id = text(value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Build a print job only; no retake request is written or confirmed. */
export function prepareDirectExamBatches({ studentId, studentIds, examIds, stage, grade, day, exams, students, settings }) {
  const selectedStudentIds = uniqueIds([...(studentIds || []), studentId]);
  if (!stage || !grade || !selectedStudentIds.length || !examIds.length) {
    throw new Error('اختر المرحلة والصف والمواد وأسماء الطلاب أولاً.');
  }
  if (!isDateKey(day)) throw new Error('اختر تاريخاً صحيحاً للاختبار.');
  const selectedStudents = selectedStudentIds.map((id) => {
    const student = students.find((item) => text(item.id) === id);
    if (!student || !matchesPrintScope(student, stage, grade)) {
      throw new Error('أحد الطلاب المختارين لا ينتمي للمرحلة والصف المحددين.');
    }
    return student;
  });
  const selectedExams = uniqueIds(examIds).map((id) => {
    const exam = activePrintExams(exams).find((item) => text(item.id) === id);
    if (!exam || !matchesPrintScope(exam, stage, grade)) throw new Error('أحد الاختبارات المختارة لا يتبع المرحلة والصف المحددين. أعد اختيار المواد.');
    return exam;
  });
  const requests = selectedStudents.flatMap((student) => selectedExams.map((exam) => ({
    status: 'confirmed', studentId: student.id, studentName: student.name,
    nationalId: student.nationalId || student.national_id,
    studentGrade: student.grade, examId: exam.id, examTitle: exam.title,
    scheduledDate: `${day}T08:00:00+03:00`,
  })));
  return prepareRetakeBatches(requests, selectedExams, selectedStudents, settings);
}

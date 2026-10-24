import { isLevelMatch } from './gradeMatch';
import {
  normalizeStudentId,
  getStudentNationalId,
  getStudentSeatNumber,
  studentNamesMatch,
} from './studentIdentity';

const examGradesOf = (exam) => {
  if (Array.isArray(exam?.grades) && exam.grades.length) return exam.grades.filter(Boolean);
  return exam?.grade ? [exam.grade] : [];
};

const studentInGrade = (s, grade) => isLevelMatch(s?.grade, grade) || isLevelMatch(s?.classroom, grade);

const studentInRoom = (s, room) => {
  const c = String(s?.classroom ?? s?.class ?? '').trim();
  return c === room || isLevelMatch(c, room);
};

/** طلاب الصف/الفصل المفترض حضورهم للاختبار */
export const studentsExpectedForExam = (exam, students, gradeFilter = '') => {
  const grades = examGradesOf(exam);
  if (!grades.length) return [];
  let pool = (students || []).filter((s) => grades.some((g) => studentInGrade(s, g)));
  if (gradeFilter) pool = pool.filter((s) => studentInGrade(s, gradeFilter));

  // Ignore the exam's classroom when no student carries it, so a free-text room never empties the roster.
  const room = String(exam?.classroom || '').trim();
  if (room) {
    const inRoom = pool.filter((s) => studentInRoom(s, room));
    if (inRoom.length) pool = inRoom;
  }
  return pool;
};

const resultIdCandidates = (r) =>
  [r.nationalId, r.national_id, r.studentId, r.detectedStudentId, r.normalizedDetectedStudentId]
    .map(normalizeStudentId)
    .filter(Boolean);

const studentIdKeys = (s) =>
  [getStudentNationalId(s), getStudentSeatNumber(s), s?.studentId, s?.student_id, s?.id]
    .map(normalizeStudentId)
    .filter(Boolean);

/** نتائج اختبار واحد مطابقة بالمعرف أولاً ثم العنوان */
export const resultsForExam = (results, exam) => {
  if (!exam) return [];
  const id = String(exam.id || '');
  const title = String(exam.title || '');
  return (results || []).filter((r) =>
    (id && String(r.examId || '') === id) || (!r.examId && title && String(r.examTitle || '') === title)
  );
};

/**
 * يربط نتائج اختبار واحد بطلابه: الربط اليدوي ← الهوية/الجلوس ← الاسم.
 * يُرجع Map(student → result)
 */
export const matchResultsToStudents = (results, students) => {
  const pool = students || [];
  const byKey = new Map();
  pool.forEach((s) => studentIdKeys(s).forEach((k) => { if (!byKey.has(k)) byKey.set(k, s); }));
  const byDbId = new Map(pool.map((s) => [String(s.id), s]));

  const matched = new Map();
  (results || []).forEach((r) => {
    let match = r.assignedStudentId ? byDbId.get(String(r.assignedStudentId)) : null;
    if (!match) {
      for (const k of resultIdCandidates(r)) {
        if (byKey.has(k)) { match = byKey.get(k); break; }
      }
    }
    if (!match && r.studentName) {
      match = pool.find((s) => !matched.has(s) && studentNamesMatch(s.name, r.studentName)) || null;
    }
    if (match && !matched.has(match)) matched.set(match, r);
  });
  return matched;
};

/**
 * يحسب الحضور والغياب لمجموعة اختبارات.
 * groups: [{ exam, results }] — results هي نتائج هذا الاختبار (كل نتيجة = طالب حاضر).
 * يُرجع { presentCount, absentCount, absent: [{ student, exam }] }
 */
export const buildExamAttendance = (groups, students, { gradeFilter = '' } = {}) => {
  let presentCount = 0;
  const absent = [];

  (groups || []).forEach(({ exam, results }) => {
    const list = results || [];
    presentCount += list.length;
    if (!exam) return;

    const expected = studentsExpectedForExam(exam, students, gradeFilter);
    if (!expected.length) return;

    const attended = matchResultsToStudents(list, expected);
    expected.forEach((s) => { if (!attended.has(s)) absent.push({ student: s, exam }); });
  });

  return { presentCount, absentCount: absent.length, absent };
};

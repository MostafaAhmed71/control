import { normalizeStudentId, normalizeStudentName } from './studentIdentity.js';

export function matchNoticeFile(fileName, students) {
  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  const id = normalizeStudentId(stem);
  if (/^\d{7,12}$/.test(id)) {
    const matches = students.filter((student) => [student.nationalId, student.national_id, student.studentId, student.student_id]
      .some((value) => normalizeStudentId(value) === id));
    return matches.length === 1 ? matches[0] : null;
  }
  const name = normalizeStudentName(stem);
  if (!name) return null;
  const matches = students.filter((student) => normalizeStudentName(student.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

export const RSVP_STATUS = {
  ATTENDING: 'attending',
  APOLOGIZED: 'apologized',
};

export const RSVP_LABELS = {
  [RSVP_STATUS.ATTENDING]: 'سيحضر',
  [RSVP_STATUS.APOLOGIZED]: 'معتذر',
  pending: 'لم يُجب بعد',
};

const STRIP_FROM_JSONB = new Set([
  'id',
  'created_at',
  'updated_at',
  'portal_national_norm',
  'portal_seat_norm',
  'portal_student_id_norm',
  'portal_detected_id_norm',
  'portal_norm_detected_id_norm',
]);

export function toJsonbPayload(item) {
  if (!item || typeof item !== 'object') return {};
  const payload = { ...item };
  for (const k of STRIP_FROM_JSONB) delete payload[k];
  return payload;
}

export function isThirdMiddleStudent(student) {
  const grade = String(student?.grade || '').trim().replace(/\s+/g, ' ');
  const stage = String(student?.stage || '').trim();

  if (grade === 'الثالث المتوسط' || grade === '3م' || grade === 'ثالث متوسط') return true;
  if (/الثالث.*متوسط|3\s*متوسط/i.test(grade)) return true;
  if (stage === 'متوسط' && /الثالث|3م|ثالث/.test(grade)) return true;

  const targetGrade = import.meta.env.VITE_TARGET_GRADE?.trim();
  if (targetGrade && grade === targetGrade) return true;

  return false;
}

/** @deprecated استخدم isThirdMiddleStudent */
export const isThirdSecondaryStudent = isThirdMiddleStudent;

export function getGraduationRsvp(student) {
  const rsvp = student?.graduationRsvp;
  if (!rsvp || typeof rsvp !== 'object') return null;
  const status = rsvp.status;
  if (status !== RSVP_STATUS.ATTENDING && status !== RSVP_STATUS.APOLOGIZED) return null;
  return {
    status,
    guardianName: String(rsvp.guardianName || '').trim(),
    updatedAt: rsvp.updatedAt || null,
  };
}

export function getRsvpDisplayStatus(student) {
  const rsvp = getGraduationRsvp(student);
  if (!rsvp) return 'pending';
  return rsvp.status;
}

export function formatRsvpDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-SA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function filterGraduationStudents(students) {
  return (students || []).filter(isThirdMiddleStudent);
}

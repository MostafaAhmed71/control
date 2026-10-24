/** مراحل اللجان — تطابق قيم stage في سجل الطالب */
export const COMMITTEE_STAGES = [
  { id: 'متوسط', label: 'المرحلة المتوسطة' },
  { id: 'ثانوي', label: 'المرحلة الثانوية' },
];

export function committeeMatchKey(name) {
  return String(name || '').replace(/^لجنة\s*/i, '').trim();
}

export function findCommitteeRecord(committees, committeeKey, stage = null) {
  if (!committeeKey || committeeKey === 'الكل') return null;
  const key = committeeMatchKey(committeeKey);
  const candidates = (committees || []).filter(
    (c) => committeeMatchKey(c.name) === key || c.name === committeeKey
  );
  if (!candidates.length) return null;
  if (stage && stage !== 'الكل') {
    const byStage = candidates.find((c) => c.stage === stage);
    if (byStage) return byStage;
  }
  return candidates[0];
}

export function findLocationRecord(locations, committeeKey) {
  if (!committeeKey) return null;
  const key = committeeMatchKey(committeeKey);
  const candidates = (locations || []).filter(
    (loc) => committeeMatchKey(loc.committee) === key || loc.committee === committeeKey
  );
  return candidates[0] || null;
}

export function formatCommitteeVenue({ committeeRecord, locationRecord } = {}) {
  if (locationRecord) {
    const parts = [];
    if (locationRecord.building) parts.push(String(locationRecord.building));
    if (locationRecord.floor) parts.push(`الدور: ${locationRecord.floor}`);
    if (locationRecord.room) parts.push(`غرفة ${locationRecord.room}`);
    if (parts.length) return parts.join(' — ');
  }
  if (committeeRecord?.room) return String(committeeRecord.room);
  return null;
}

export function resolveStudentCommitteeVenue(student, committees, locations) {
  const committeeKey = String(student?.committee || '').trim();
  if (!committeeKey) return '—';
  const committeeRecord = findCommitteeRecord(committees, committeeKey, student?.stage);
  const locationRecord = findLocationRecord(locations, committeeKey);
  return formatCommitteeVenue({ committeeRecord, locationRecord }) || '—';
}

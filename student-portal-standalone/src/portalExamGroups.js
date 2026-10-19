export const PORTAL_EXAM_GROUPS = [
  { value: 'period1', label: 'اختبارات الفترة الأولى' },
  { value: 'qudrat', label: 'معسكر القدرات' },
];

const normalize = (value) => String(value || '').normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670]/g, '').replace(/ـ/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();

// Older records have only a title; new records can carry an explicit group.
export const getPortalExamGroup = (result) => {
  const explicit = result?.portalExamGroup || result?.examCategory || result?.category;
  if (explicit === 'period1' || explicit === 'qudrat') return explicit;
  const title = normalize(result?.examTitle || result?.title);
  const metadata = normalize([explicit, result?.subject, result?.examSubject, result?.program].filter(Boolean).join(' '));
  if (/(قدرات|qudrat|aptitude)/i.test(`${metadata} ${title}`)) return 'qudrat';
  // Camp exams may be named simply "الاختبار الأول", "الاختبار الثاني", etc.
  const numberedExam = /^(?:الاختبار|اختبار)\s+(?:الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|[0-9٠-٩۰-۹]+)(?:\s*[-–—:]?\s*نموذج\s*[ا-يa-z0-9٠-٩]+)?$/i;
  if (!metadata && numberedExam.test(title)) return 'qudrat';
  return 'period1';
};

export const getPortalExamTitle = (result) => String(result?.examTitle || '').trim() || 'نتيجة الاختبار المعتمدة';

export const getPortalGroupResults = (results, group) =>
  group ? (results || []).filter((result) => getPortalExamGroup(result) === group) : [];

const examOrder = (title) => {
  const text = normalize(title).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const number = text.match(/(?:الاختبار|اختبار)\s*(\d+)/);
  if (number) return Number(number[1]);
  const ordinal = text.match(/(?:الاختبار|اختبار)\s+(الحادي عشر|الثاني عشر|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)(?=\s|$)/);
  return ordinal ? ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'].indexOf(ordinal[1]) + 1 : Infinity;
};

export const getPortalExamOptions = (results, group) =>
  [...new Set(getPortalGroupResults(results, group).map(getPortalExamTitle))]
    .sort((a, b) => (group === 'qudrat' ? (examOrder(a) - examOrder(b)) || 0 : 0) || a.localeCompare(b, 'ar', { numeric: true }));

/**
 * الاختبارات الوطنية: تقسيم الاختبار إلى 3 أقسام × 10 أسئلة وحساب الإحصائيات.
 */
import { extractAnswersFromResult, normalizeExamWeights } from './omrGrading';
import {
  normalizeStudentId,
  getStudentNationalId,
  studentNamesMatch,
  findStudentByName,
} from './studentIdentity';

export const DEFAULT_WATANIA_SECTIONS = [
  { subject: 'اللغة العربية', from: 1, to: 10 },
  { subject: 'العلوم', from: 11, to: 20 },
  { subject: 'الرياضيات', from: 21, to: 30 },
];

export const examSections = (exam) => {
  const s = Array.isArray(exam?.sections) ? exam.sections : [];
  return DEFAULT_WATANIA_SECTIONS.map((def, i) => ({
    ...def,
    subject: String(s[i]?.subject || def.subject).trim() || def.subject,
  }));
};

export const LETTER_AR = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

const toNum = (v, d = 0) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : d;
};

export const isResultApproved = (r) =>
  r?.approved === true || r?.confirmed === true || r?.approvedAt != null;

export const resultBelongsToExam = (r, exam) =>
  !!exam && (String(r?.examId || '') === String(exam.id) || (exam.title && r?.examTitle === exam.title));

/** مفتاح موحّد للطالب لمنع احتساب الورقة مرتين */
export const resultStudentKey = (r) =>
  String(r?.assignedStudentId || '') ||
  normalizeStudentId(r?.nationalId || r?.studentId || '') ||
  String(r?.id || '');

/**
 * درجة كل قسم لنتيجة واحدة.
 * يعتمد على مفتاح الإجابة الحالي للاختبار حتى تبقى الإحصائية صحيحة بعد تعديل المفتاح.
 */
export const scoreResultBySection = (result, exam) => {
  const keys = exam?.keys || {};
  const weights = normalizeExamWeights(exam?.weights || {});
  const answers = extractAnswersFromResult(result);
  const hasKeys = Object.keys(keys).some((k) => keys[k]);
  const sections = examSections(exam);

  const perQuestion = {};
  for (let q = 1; q <= 30; q++) {
    const qs = String(q);
    const d = result?.details?.[qs];
    const correct = hasKeys ? String(keys[qs] || '') : String(d?.correct_option || '');
    if (!correct) continue;
    const got = String(answers[qs] ?? d?.student_answer ?? '');
    const w = hasKeys ? toNum(weights[qs], 1) : toNum(d?.weight, 1);
    perQuestion[q] = { got, correct, ok: got === correct, weight: w };
  }

  const bySection = sections.map((sec) => {
    let score = 0;
    let total = 0;
    for (let q = sec.from; q <= sec.to; q++) {
      const pq = perQuestion[q];
      if (!pq) continue;
      total += pq.weight;
      if (pq.ok) score += pq.weight;
    }
    return { subject: sec.subject, score, total };
  });
  const score = bySection.reduce((a, s) => a + s.score, 0);
  const total = bySection.reduce((a, s) => a + s.total, 0);
  return { bySection, score, total, perQuestion };
};

const gradeOf = (s) => String(s?.grade || s?.classroom || '').trim();

export const studentsForFilter = (students, { stageGrades = [], grade = '' } = {}) =>
  (students || []).filter((s) => {
    const g = gradeOf(s);
    if (grade) return g === grade;
    if (stageGrades.length) return stageGrades.includes(g);
    return true;
  });

/**
 * يجمع نتائج الاختبار المعتمدة (طالب واحد = ورقة واحدة) مع ربطها بسجل الطالب.
 */
export const collectExamTesters = (results, exam, students, { grade = '', stageGrades = [] } = {}) => {
  const byId = new Map((students || []).map((s) => [String(s.id), s]));
  const byNat = new Map();
  (students || []).forEach((s) => {
    const n = normalizeStudentId(getStudentNationalId(s));
    if (n) byNat.set(n, s);
  });

  const seen = new Map();
  for (const r of results || []) {
    if (!isResultApproved(r) || !resultBelongsToExam(r, exam)) continue;
    const resultName = String(r.studentName || '').trim();
    const resultGrade = String(r.studentGrade || '').trim();
    let student = byId.get(String(r.assignedStudentId || '')) || null;
    if (student && resultName && !studentNamesMatch(student.name, resultName)) {
      student = null;
    }
    if (!student) {
      student = byNat.get(normalizeStudentId(r.nationalId || '')) || null;
      if (student && resultName && !studentNamesMatch(student.name, resultName)) student = null;
    }
    if (!student && resultName) {
      student = findStudentByName(students, resultName, resultGrade);
    }
    const g = resultGrade || (student ? gradeOf(student) : '');
    if (grade && g && g !== grade) continue;
    if (!grade && stageGrades.length && g && !stageGrades.includes(g)) continue;
    const key = student ? `s:${student.id}` : `r:${resultStudentKey(r)}`;
    const prev = seen.get(key);
    const ts = Date.parse(r.updatedAt || r.approvedAt || r.timestamp || '') || 0;
    if (prev && prev.ts >= ts) continue;
    seen.set(key, {
      ts,
      result: r,
      student,
      name: resultName || student?.name || '—',
      grade: g,
      ...scoreResultBySection(r, exam),
    });
  }
  return [...seen.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
};

export const summarizeSections = (testers, exam, totalStudents) => {
  const sections = examSections(exam);
  const n = testers.length;
  const rows = sections.map((sec, i) => {
    const sum = testers.reduce((a, t) => a + (t.bySection[i]?.score || 0), 0);
    const outOf = testers.length
      ? Math.max(...testers.map((t) => t.bySection[i]?.total || 0))
      : sectionKeyTotal(exam, sec);
    return {
      subject: sec.subject,
      range: `${sec.from} – ${sec.to}`,
      outOf,
      avgTesters: n ? sum / n : 0,
      avgAll: totalStudents ? sum / totalStudents : 0,
    };
  });
  const sumAll = testers.reduce((a, t) => a + t.score, 0);
  const outOfAll = rows.reduce((a, r) => a + r.outOf, 0);
  return {
    rows,
    total: {
      subject: 'الدرجة النهائية',
      range: '1 – 30',
      outOf: outOfAll,
      avgTesters: n ? sumAll / n : 0,
      avgAll: totalStudents ? sumAll / totalStudents : 0,
    },
  };
};

const sectionKeyTotal = (exam, sec) => {
  const keys = exam?.keys || {};
  const weights = normalizeExamWeights(exam?.weights || {});
  let t = 0;
  for (let q = sec.from; q <= sec.to; q++) {
    if (keys[String(q)]) t += toNum(weights[String(q)], 1);
  }
  return t;
};

/** تحليل الأسئلة لقسم معيّن: عدد الصحيحة والخاطئة لكل سؤال */
export const analyzeQuestions = (testers, exam, sectionIndex) => {
  const sec = examSections(exam)[sectionIndex] || DEFAULT_WATANIA_SECTIONS[0];
  const keys = exam?.keys || {};
  const out = [];
  for (let q = sec.from; q <= sec.to; q++) {
    let correct = 0;
    let wrong = 0;
    let blank = 0;
    for (const t of testers) {
      const pq = t.perQuestion[q];
      if (!pq) continue;
      if (pq.ok) correct += 1;
      else if (!pq.got) blank += 1;
      else wrong += 1;
    }
    const answered = correct + wrong + blank;
    out.push({
      q,
      key: LETTER_AR[String(keys[String(q)] || '').toUpperCase()] || '—',
      correct,
      wrong: wrong + blank,
      blank,
      pct: answered ? (correct / answered) * 100 : 0,
    });
  }
  return out;
};

export const fmt = (v, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
};

import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
import { normalizeStudentId, normalizeStudentName } from './studentIdentity.js';

export function subjectTemplateKey(value) {
  const key = normalizeStudentName(value).replace(/\s/g, '');
  if (/اجتماعي/.test(key)) return 'social';
  if (/اسلامي|قران|تفسير|توحيد|فقه|حديث/.test(key)) return 'islamic';
  if (/انجليزي|english/.test(key)) return 'english';
  if (/عربي|لغتي/.test(key)) return 'arabic';
  if (/رياضيات/.test(key)) return 'math';
  if (/علوم/.test(key)) return 'science';
  return key;
}

const xmlText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Patch only grade cells inside the original ZIP. Styles, print setup, identities,
// student order and all other workbook parts remain byte-for-byte unchanged.
export async function fillGradeTemplate(bytes, results, absent) {
  const zip = await JSZip.loadAsync(bytes);
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const path = 'xl/worksheets/sheet1.xml';
  if (!zip.file(path) || !sheet?.B4 || !sheet?.D4) throw new Error('بنية قالب المادة غير مدعومة.');
  let xml = await zip.file(path).async('string');
  const setCell = (ref, value, formula) => {
    const re = new RegExp(`<c\\b[^>]*?\\br="${ref}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    if (!re.test(xml)) throw new Error(`خلية ${ref} غير موجودة في القالب.`);
    xml = xml.replace(re, (old) => {
      let attrs = old.slice(0, old.indexOf('>')).replace(/\/$/, '').replace(/\s+t="[^"]*"/g, '');
      if (typeof value === 'string' && value !== '') return `${attrs} t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`;
      return `${attrs}>${formula ? `<f>${xmlText(formula)}</f>` : ''}${value === '' ? '' : `<v>${value}</v>`}</c>`;
    });
  };
  const roster = [];
  const end = XLSX.utils.decode_range(sheet['!ref']).e.r + 1;
  for (let row = 6; row <= end; row++) {
    const name = sheet[`C${row}`]?.v;
    if (name) roster.push({ row, name: normalizeStudentName(name), id: normalizeStudentId(sheet[`B${row}`]?.v) });
  }
  const byId = new Map(roster.filter((r) => r.id).map((r) => [r.id, r]));
  const match = (record) => {
    const ids = [record.nationalId, record.national_id, record.studentId, record.seatNumber].map(normalizeStudentId).filter(Boolean);
    for (const id of ids) if (byId.has(id)) return byId.get(id);
    const name = normalizeStudentName(record.studentName || record.name);
    const candidates = roster.filter((r) => r.name === name);
    if (candidates.length !== 1) return null;
    // A different national ID is a conflict, not an invitation to match by name.
    if (ids.some((id) => /^\d{10}$/.test(id) && candidates[0].id && id !== candidates[0].id)) return null;
    return candidates[0];
  };
  const matched = new Map();
  const time = (r) => Date.parse(r.updatedAt || r.approvedAt || r.timestamp || r.createdAt || '') || 0;
  for (const result of results) {
    const student = match(result);
    if (!student) throw new Error(`الطالب «${result.studentName || result.studentId}» غير مطابق لقائمة القالب. راجع الهوية أو حدّث القالب.`);
    const score = result.score == null || result.score === '' ? NaN : Number(result.score);
    if (!Number.isFinite(score) || score < 0 || score > 20) throw new Error(`درجة «${result.studentName}» يجب أن تكون بين 0 و20.`);
    const previous = matched.get(student.row);
    if (previous && time(previous) === time(result) && Number(previous.score) !== score) throw new Error('توجد درجتان مختلفتان للطالب بنفس التاريخ. اختر اختبارًا واحدًا للتصدير.');
    if (!previous || time(result) > time(previous)) matched.set(student.row, result);
  }
  const absentRows = new Set(absent.map(({ student }) => match(student)?.row).filter(Boolean));
  setCell('D5', 20);
  setCell('E5', 40);
  setCell('F5', 60);
  for (const student of roster) {
    const result = matched.get(student.row);
    const isAbsent = !result && absentRows.has(student.row);
    // Unselected students remain blank, rather than being falsely marked absent.
    setCell(`D${student.row}`, result ? Number(result.score) : isAbsent ? 'غائب' : '');
    setCell(`E${student.row}`, result ? 40 : isAbsent ? 0 : '');
    setCell(`F${student.row}`, result ? Number(result.score) + 40 : isAbsent ? 0 : '',
      result || isAbsent ? `SUM(D${student.row}:E${student.row})` : null);
  }
  zip.file(path, xml, { createFolders: false });
  return zip.generateAsync({ type: 'arraybuffer' });
}

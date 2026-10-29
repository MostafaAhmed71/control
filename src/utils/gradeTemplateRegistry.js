import { isLevelMatch } from './gradeMatch.js';
import { fillGradeTemplate, subjectTemplateKey } from './gradeTemplateExport.js';

const files = import.meta.glob('/قوالب/*.xlsx', { query: '?url', import: 'default', eager: true });
const templates = Object.entries(files).filter(([path]) => !/\(\d+\)\.xlsx$/.test(path)).map(([path, url]) => {
  const [subject, grade] = path.split('/').at(-1).split('_');
  return { subject, grade, url };
});

export async function exportUsingGradeTemplate(results, absent, { grade, subject }) {
  const matches = templates.filter((item) => isLevelMatch(item.grade, grade) && subjectTemplateKey(item.subject) === subjectTemplateKey(subject));
  if (!matches.length) return null;
  if (matches.length !== 1) throw new Error('يوجد أكثر من قالب مطابق للمادة والصف.');
  const response = await fetch(matches[0].url);
  if (!response.ok) throw new Error('تعذر تحميل قالب المادة.');
  try {
    return await fillGradeTemplate(await response.arrayBuffer(), results, absent);
  } catch (error) {
    throw new Error(`المادة: ${subject}\nالصف: ${grade}\n${error.message}`);
  }
}

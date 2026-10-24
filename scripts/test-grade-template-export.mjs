import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
import { fillGradeTemplate, subjectTemplateKey } from '../src/utils/gradeTemplateExport.js';

const directory = new URL('../قوالب/', import.meta.url);
const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.xlsx'));
assert.ok(files.length >= 18);
for (const file of files) {
  const bytes = await fs.readFile(new URL(file, directory));
  const original = XLSX.read(bytes);
  const sheet = original.Sheets[original.SheetNames[0]];
  const result = { studentName: sheet.C6.v, nationalId: sheet.B6.v, score: 10, timestamp: '2026-10-22' };
  const absent = [{ student: { name: sheet.C7.v, nationalId: sheet.B7.v } }];
  const output = await fillGradeTemplate(bytes, [result], absent);
  const read = XLSX.read(output);
  const filled = read.Sheets[read.SheetNames[0]];
  assert.equal(filled.D5.v, 20);
  assert.equal(filled.F5.v, 60);
  assert.equal(filled.D6.v, 10);
  assert.equal(filled.E6.v, 40);
  assert.equal(filled.F6.v, 50);
  assert.equal(filled.F6.f, 'SUM(D6:E6)');
  assert.equal(filled.D7.v, 'غائب');
  assert.equal(filled.E7.v, 0);
  assert.equal(filled.F7.v, 0);
  assert.equal(filled.D8?.v ?? '', '');
  assert.equal(filled.E8?.v ?? '', '');
  assert.equal(filled.B6.v, sheet.B6.v);
  assert.equal(filled.C6.v, sheet.C6.v);
  const before = await JSZip.loadAsync(bytes);
  const after = await JSZip.loadAsync(output);
  assert.deepEqual(Object.keys(before.files), Object.keys(after.files));
  for (const [path, entry] of Object.entries(before.files)) {
    if (entry.dir || path === 'xl/worksheets/sheet1.xml') continue;
    assert.deepEqual(await entry.async('uint8array'), await after.file(path).async('uint8array'), `Modified template part: ${path}`);
  }
  await assert.rejects(fillGradeTemplate(bytes, [{ ...result, nationalId: '9999999999', studentId: '9999999999' }], []), /غير مطابق/);
  await assert.rejects(fillGradeTemplate(bytes, [{ ...result, score: 30 }], []), /20/);
  const latest = await fillGradeTemplate(bytes, [result, { ...result, score: 15, timestamp: '2026-10-23' }], absent);
  const latestBook = XLSX.read(latest);
  assert.equal(latestBook.Sheets[latestBook.SheetNames[0]].F6.v, 55);
}
assert.equal(subjectTemplateKey('لغة إنجليزية'), subjectTemplateKey('اللغة الانجليزية'));
assert.equal(subjectTemplateKey('دراسات إسلامية'), subjectTemplateKey('القرآن الكريم والدراسات الإسلامية'));
console.log(`PASS: ${files.length} templates; scores, absence, latest result, identity conflicts, untouched workbook parts and subject aliases.`);

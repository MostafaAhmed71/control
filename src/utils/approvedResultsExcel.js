import XLSX from 'xlsx-js-style';

export { XLSX as gradesXlsx };

export function createGradesWorkbook(results, absent, { grade = '', subject = '', school = 'متوسطة نخبة الشمال الأهلية', year = '1448', term = 'الفصل الأول' } = {}) {
  const rows = [
    ['وزارة التعليم', '', '', 'كشف درجات الطلاب', '', ''],
    ['الإدارة العامة للتعليم بمنطقة الحدود الشمالية', '', '', `المادة: ${subject}   •   الصف: ${grade} / -- الكل --`, '', ''],
    [school, '', '', `${term}   •   ${year}`, '', ''],
    ['#', 'رقم الهوية', 'الطالب', 'تقويمات تحريرية', 'المهام الأدائية\nوالمشاركة والتفاعل', 'المجموع'],
    ['', '', '', 20, 40, 60],
  ];
  const entries = [
    ...results.map((r) => ({ name: r.studentName || r.studentId || '', id: r.nationalId || r.studentId || '', score: r.score })),
    ...absent.map(({ student }) => ({ name: student.name || '', id: student.nationalId || student.national_id || student.studentId || student.seatNumber || '', score: 'غائب' })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  entries.forEach((entry, i) => {
    const score = entry.score === 'غائب' ? 'غائب' : entry.score == null || entry.score === '' ? '' : Number(entry.score);
    if (typeof score === 'number' && (!Number.isFinite(score) || score < 0 || score > 20)) {
      throw new Error(`درجة ${entry.name} خارج نطاق 0 إلى 20. يلزم مراجعتها قبل التصدير من 60.`);
    }
    rows.push([i + 1, String(entry.id), entry.name, score, score === 'غائب' ? 0 : 40, '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const border = { style: 'thin', color: { rgb: '000000' } };
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 6; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = ws[address] || (ws[address] = { t: 's', v: '' });
      cell.s = {
        font: { name: 'Arial', sz: r < 5 ? 12 : 11, bold: r < 5, color: { rgb: r === 0 || (r === 3 && c === 5) ? 'FFFFFF' : '000000' } },
        alignment: { horizontal: c === 2 && r >= 5 ? 'right' : 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
        border: { top: border, bottom: border, left: border, right: border },
        fill: { fgColor: { rgb: r === 0 ? '206D80' : r === 3 && c === 5 ? '206D80' : r === 3 && c >= 3 ? '92C9D5' : r === 4 ? 'FFF2B3' : r < 4 ? 'E7EDF0' : c === 5 ? 'C6E6C4' : 'FFFFFF' } },
      };
      if (c === 1) cell.z = '@';
    }
    if (r >= 5) {
      const score = rows[r][3];
      ws[`F${r + 1}`] = { ...ws[`F${r + 1}`], t: 'n',
        f: `SUM(D${r + 1}:E${r + 1})`, v: (typeof score === 'number' ? score : 0) + rows[r][4] };
    }
  }
  ws['!merges'] = [0, 1, 2].flatMap((r) => [
    { s: { r, c: 0 }, e: { r, c: 2 } }, { s: { r, c: 3 }, e: { r, c: 5 } },
  ]).concat([0, 1, 2].map((c) => ({ s: { r: 3, c }, e: { r: 4, c } })));
  ws['!cols'] = [5, 18, 45, 18, 22, 16].map((wch) => ({ wch }));
  ws['!rows'] = rows.map((_, r) => ({ hpt: r === 3 ? 55 : r < 3 ? 25 : 20 }));
  ws['!sheetViews'] = [{ rightToLeft: true }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }], CalcPr: { fullCalcOnLoad: true } };
  XLSX.utils.book_append_sheet(wb, ws, 'كشف درجات الطلاب');
  return wb;
}

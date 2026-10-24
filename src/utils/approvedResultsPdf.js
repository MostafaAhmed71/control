import { jsPDF } from 'jspdf';

const PAGE_ROWS = 24;
const WIDTH = 794;
const HEIGHT = 1123;

export function buildApprovedPdfRows(results, absent) {
  return [
    ...results.map((r) => [r.studentName || r.studentId || '—', r.studentId || '',
      r.examTitle || '', 'حاضر', r.score == null ? '' : `${r.score} / ${r.total ?? ''}`,
      r.percentage == null ? '' : `${r.percentage}%`]),
    ...absent.map(({ student, exam }) => [student.name || '',
      student.nationalId || student.national_id || student.seatNumber || student.id || '',
      exam?.title || '', 'غائب', '', '']),
  ];
}

// Browser canvas shapes Arabic using the same fonts as the application's printed sheets.
// Only the generated table is rendered; scanned sheets are never requested.
export async function createApprovedResultsPdf(results, absent, { grade, subject }) {
  if (document.fonts?.ready) await document.fonts.ready;
  const rows = buildApprovedPdfRows(results, absent);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_ROWS));
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  for (let page = 0; page < pages; page++) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء ملف PDF.');
    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';
    const text = (value, x, y, width, size = 13, bold = false) => {
      ctx.font = `${bold ? 'bold ' : ''}${size}px Tahoma, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f2744';
      const label = String(value ?? '');
      const measured = ctx.measureText(label).width;
      const fitted = Math.max(10, Math.min(size, size * (width - 12) / Math.max(1, measured)));
      ctx.font = `${bold ? 'bold ' : ''}${fitted}px Tahoma, Arial, sans-serif`;
      // Clip in its cell rather than overlap adjacent columns for unusually long names.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - width / 2 + 3, y - 17, width - 6, 34);
      ctx.clip();
      ctx.fillText(label, x, y);
      ctx.restore();
    };
    text('كشف المعتمدين', WIDTH / 2, 46, 714, 24, true);
    text(`${grade} - ${subject}`, WIDTH / 2, 83, 714, 19, true);
    text(`عدد الحضور: ${results.length}     عدد الغياب: ${absent.length}`, WIDTH / 2, 119, 714, 14);
    const widths = [36, 198, 136, 154, 60, 78, 52];
    const headers = ['م', 'اسم الطالب', 'الرقم التعريفي', 'الاختبار', 'الحالة', 'الدرجة', 'النسبة'];
    const drawRow = (values, y, header = false, stripe = false) => {
      let right = WIDTH - 40;
      values.forEach((value, col) => {
        const width = widths[col];
        const left = right - width;
        ctx.fillStyle = header ? '#e2e8f0' : stripe ? '#f8fafc' : '#ffffff';
        ctx.fillRect(left, y, width, 35);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(left, y, width, 35);
        text(value, left + width / 2, y + 17.5, width, col === 2 ? 11 : 13, header);
        right = left;
      });
    };
    drawRow(headers, 155, true);
    rows.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS).forEach((row, i) => {
      drawRow([page * PAGE_ROWS + i + 1, ...row], 190 + i * 35, false, i % 2 === 1);
    });
    if (!rows.length) text('لا توجد نتائج أو بيانات طلاب لهذه المادة', WIDTH / 2, 230, 714, 15);
    text(`صفحة ${page + 1} من ${pages}`, WIDTH / 2, 1075, 714, 12);
    if (page) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
    canvas.width = 0;
    canvas.height = 0;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return pdf.output('arraybuffer');
}

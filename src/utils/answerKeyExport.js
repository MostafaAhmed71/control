import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import jsPDF from 'jspdf';

/** Reuse the printable answer sheet in an isolated document, preserving Arabic. */
export async function exportAnswerKeyArchive(exams, renderHtml) {
  const subjects = new Map();
  for (const exam of exams) {
    const subject = String(exam.subject || '').trim() || 'بدون مادة';
    const grade = String(exam.grade || '').trim() || 'بدون صف';
    const stage = String(exam.stage || '').trim();
    const key = JSON.stringify([subject, grade, stage]);
    if (!subjects.has(key)) subjects.set(key, { label: `${subject} - ${grade}${stage ? ` - ${stage}` : ''}`, exams: [] });
    subjects.get(key).exams.push(exam);
  }
  const zip = new JSZip();
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;pointer-events:none;';
  document.body.appendChild(frame);
  try {
    let index = 0;
    for (const { label, exams: subjectExams } of subjects.values()) {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      let pageCount = 0;
      for (const exam of subjectExams) {
        const loaded = new Promise((resolve, reject) => {
          frame.onload = resolve;
          frame.onerror = () => reject(new Error('Unable to load answer sheet'));
        });
        frame.srcdoc = renderHtml(exam);
        await loaded;
        const doc = frame.contentDocument;
        await doc.fonts.ready;
        doc.querySelector('.no-print')?.remove();
        doc.body.style.width = '190mm';
        const sheet = doc.querySelector('.sheet');
        const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', logging: false });
        // Split tall sheets across pages without cutting through question rows.
        const rowEdges = [...sheet.querySelectorAll('tr')].map((row) => row.getBoundingClientRect());
        const sheetTop = sheet.getBoundingClientRect().top;
        const pixelsPerMm = canvas.width / 190;
        const pageHeight = Math.floor(277 * pixelsPerMm);
        let offset = 0;
        while (offset < canvas.height) {
          let end = Math.min(offset + pageHeight, canvas.height);
          if (end < canvas.height) {
            const crossing = rowEdges.filter((row) => (row.top - sheetTop) * 2 < end && (row.bottom - sheetTop) * 2 > end);
            if (crossing.length) end = Math.floor(Math.min(...crossing.map((row) => (row.top - sheetTop) * 2)));
          }
          if (end <= offset) end = Math.min(offset + pageHeight, canvas.height);
          const page = document.createElement('canvas');
          page.width = canvas.width;
          page.height = end - offset;
          page.getContext('2d').drawImage(canvas, 0, offset, canvas.width, page.height, 0, 0, canvas.width, page.height);
          if (pageCount++) pdf.addPage();
          pdf.addImage(page.toDataURL('image/jpeg', 0.95), 'JPEG', 10, 10, 190, page.height / pixelsPerMm);
          offset = end;
          page.width = page.height = 0;
        }
        canvas.width = canvas.height = 0;
      }
      const filename = Array.from(label.replace(/[<>:"/\\|?*]/g, '_'), (char) => char.charCodeAt(0) < 32 ? '_' : char).join('').slice(0, 150);
      zip.file(`${++index}-${filename}.pdf`, pdf.output('arraybuffer'));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'نماذج الإجابات الصحيحة.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return subjects.size;
  } finally {
    frame.remove();
  }
}

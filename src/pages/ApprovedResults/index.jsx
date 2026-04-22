import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, FileText, CheckCircle2, Printer, Trophy,
  Users, BookOpen, ChevronDown, AlertCircle, Download,
  Filter, Star, TrendingUp, ClipboardList, RefreshCcw, Wrench, Loader2, Edit2, X, Trash2, Calendar
} from 'lucide-react';
import { getOmrResults, getOmrExams, getStudents, saveOmrResult, deleteOmrResult } from '../../utils/dataService';

/* ── Grade helpers ── */
const getGradeLabel = (pct) => {
  const p = parseFloat(pct);
  if (p >= 90) return { label: 'ممتاز', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (p >= 80) return { label: 'جيد جداً', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' };
  if (p >= 70) return { label: 'جيد', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' };
  if (p >= 60) return { label: 'مقبول', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };
  return { label: 'ضعيف', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' };
};

const getSchoolNameByStage = (stage = '') => {
  const s = String(stage || '').trim();
  if (s === 'ابتدائي' || s === 'الابتدائي') return 'مدارس نخبة الشمال الأهلية والعالمية';
  return 'متوسطة وثانوية نخبة الشمال الأهلية';
};

/* ── Print approved list ── */
const printApprovedList = (results, examTitle, examStage) => {
  if (!results.length) return;
  const schoolName = getSchoolNameByStage(examStage);

  const sorted = [...results].sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

  const rows = sorted.map((r, idx) => {
    const g = getGradeLabel(r.percentage);
    const pct = parseFloat(r.percentage).toFixed(1);
    return `
    <tr style="background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center;font-weight:700;color:#475569">${idx + 1}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;font-weight:700;color:#1e293b">${r.studentName || r.studentId}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center;font-family:monospace;color:#64748b">${r.studentId}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center;color:#475569">${r.studentGrade || '—'}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center;font-weight:900;font-size:16px;color:#1e293b">${r.score} / ${r.total}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center;font-weight:700;color:${g.color.replace('text-', '')}">${pct}%</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;text-align:center">
        <span style="background:${g.bg.replace('bg-','')};color:${g.color.replace('text-','')};padding:3px 10px;border-radius:20px;font-weight:700;font-size:12px;border:1px solid">${g.label}</span>
      </td>
    </tr>`;
  }).join('');

  const pass = sorted.filter(r => parseFloat(r.percentage) >= 50).length;
  const fail = sorted.length - pass;
  const avg = sorted.reduce((s, r) => s + parseFloat(r.percentage), 0) / sorted.length;

  const win = window.open('', '_blank', 'width=1000,height=750');
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="UTF-8">
    <title>كشف المعتمدين — ${examTitle}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; direction: rtl; }
      @media print {
        body { background: white; }
        .no-print { display: none !important; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; }
      }
    </style>
  </head><body>
    <div class="no-print" style="background:#1e3a5f;color:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:99">
      <span style="font-weight:700">📋 كشف المعتمدين — ${results.length} طالب</span>
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px">🖨️ طباعة الآن</button>
    </div>

    <div style="padding:32px;max-width:960px;margin:0 auto">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;border-radius:14px;padding:24px 32px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:20px;font-weight:900">${schoolName}</div>
          <div style="font-size:14px;opacity:0.85;margin-top:6px">كشف نتائج الاختبار المعتمدة — ${examTitle}</div>
          <div style="font-size:12px;opacity:0.65;margin-top:4px">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:14px 22px;text-align:center">
          <div style="font-size:36px;font-weight:900">${results.length}</div>
          <div style="font-size:12px;opacity:0.85">طالب معتمد</div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#16a34a">${pass}</div>
          <div style="font-size:12px;color:#64748b;font-weight:600">ناجح</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#dc2626">${fail}</div>
          <div style="font-size:12px;color:#64748b;font-weight:600">راسب</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#2563eb">${avg.toFixed(1)}%</div>
          <div style="font-size:12px;color:#64748b;font-weight:600">متوسط الدرجات</div>
        </div>
      </div>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff">
        <thead>
          <tr style="background:#1e3a5f;color:#fff">
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">#</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:right">اسم الطالب</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">الرقم التعريفي</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">الصف</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">الدرجة</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">النسبة</th>
            <th style="padding:12px;border:1px solid #2d5a9e;text-align:center">التقدير</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Footer -->
      <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:center;border-top:2px dashed #e2e8f0;padding-top:16px">
        <div style="font-size:11px;color:#94a3b8">تم إنشاء هذا الكشف بواسطة نظام OMR — نخبة الشمال</div>
        <div style="background:#dcfce7;color:#15803d;font-weight:900;font-size:13px;padding:6px 16px;border-radius:8px;border:2px solid #86efac">✅ كشف رسمي معتمد</div>
        <div style="font-size:11px;color:#94a3b8">${new Date().toLocaleDateString('ar-SA')}</div>
      </div>
    </div>
  </body></html>`);
  win.document.close();
};

/* ── Print Individual Slips ── */
const printApprovedSlips = (results, examStage) => {
  if (!results.length) return;
  const schoolName = getSchoolNameByStage(examStage);

  const getLetterAr = (l) => ({ A: 'أ', B: 'ب', C: 'ج', D: 'د', E: 'هـ' }[l] || l || '—');

  const slips = results.map(r => {
    const g = getGradeLabel(r.percentage);
    // Remove "text-" class name prefixes to generate hex values
    let gradeHexColor = '#475569';
    if (g.color.includes('emerald')) gradeHexColor = '#16a34a';
    else if (g.color.includes('blue')) gradeHexColor = '#2563eb';
    else if (g.color.includes('violet')) gradeHexColor = '#7c3aed';
    else if (g.color.includes('amber')) gradeHexColor = '#d97706';
    else if (g.color.includes('rose')) gradeHexColor = '#dc2626';

    const details = r.details || {};
    const qs = Object.keys(details).sort((a, b) => parseInt(a) - parseInt(b));

    // Split questions into two columns (Q1-15 right, Q16-30 left — RTL)
    const col1 = qs.filter(q => parseInt(q) <= 15);
    const col2 = qs.filter(q => parseInt(q) > 15);
    const maxRows = Math.max(col1.length, col2.length, 1); // at least 1 row

    const rows = Array.from({ length: maxRows }, (_, i) => {
      const q1 = col1[i]; const q2 = col2[i];
      const d1 = q1 ? details[q1] : null;
      const d2 = q2 ? details[q2] : null;
      return { q1, d1, q2, d2 };
    });

    const tableRows = rows.map(({ q1, d1, q2, d2 }) => `
      <tr>
        ${q2 ? `
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold;color:${d2.is_correct ? '#15803d' : '#dc2626'}">${d2.is_correct ? `+${d2.weight}` : '✗'}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center">${getLetterAr(d2.correct_option)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold">${getLetterAr(d2.student_answer)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;background:#f8fafc;font-weight:bold;color:#1e293b">${q2} <span style="font-size:8px;color:#94a3b8">(${d2.weight}ن)</span></td>
        ` : '<td colspan="4" style="border:1px solid #e5e7eb"></td>'}
        <td style="border:1px solid #e5e7eb;width:20px;background:#f1f5f9"></td>
        ${q1 ? `
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold;color:${d1.is_correct ? '#15803d' : '#dc2626'}">${d1.is_correct ? `+${d1.weight}` : '✗'}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center">${getLetterAr(d1.correct_option)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold">${getLetterAr(d1.student_answer)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;background:#f8fafc;font-weight:bold;color:#1e293b">${q1} <span style="font-size:8px;color:#94a3b8">(${d1.weight}ن)</span></td>
        ` : '<td colspan="4" style="border:1px solid #e5e7eb"></td>'}
      </tr>`).join('');

    return `
    <div class="slip" style="page-break-after:always;padding:28px 32px;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;max-width:750px;margin:0 auto;box-sizing:border-box">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;border-radius:12px;padding:18px 24px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:900;letter-spacing:0.5px">${schoolName}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:4px">نظام التصحيح الآلي OMR — نتيجة الاختبار</div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 16px;text-align:center">
          <div style="font-size:30px;font-weight:900">${r.score}/${r.total}</div>
          <div style="font-size:12px;opacity:0.85">${parseFloat(r.percentage).toFixed(1)}%</div>
        </div>
      </div>

      <!-- Student Info -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><span style="color:#64748b;font-size:12px">اسم الطالب</span><br><strong style="font-size:15px;color:#1e293b">${r.studentName || r.studentId}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الصف</span><br><strong style="font-size:14px;color:#1e293b">${r.studentGrade || '—'}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الاختبار</span><br><strong style="font-size:13px;color:#1e293b">${r.examTitle || '—'}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الرقم التعريفي</span><br><strong style="font-size:13px;color:#475569;font-family:monospace">${r.studentId}</strong></div>
      </div>

      <!-- Score Visual -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;background:#fff;border:2px solid ${gradeHexColor}22;border-radius:12px;padding:14px 20px">
        <div style="font-size:42px;font-weight:900;color:${gradeHexColor};line-height:1">${r.score}<span style="font-size:18px;color:#94a3b8">/${r.total}</span></div>
        <div style="flex:1">
          <div style="background:#f1f5f9;border-radius:999px;height:10px;overflow:hidden">
            <div style="height:100%;width:${r.percentage}%;background:${gradeHexColor};border-radius:999px"></div>
          </div>
          <div style="margin-top:6px;font-size:13px;color:${gradeHexColor};font-weight:700">${g.label} — ${parseFloat(r.percentage).toFixed(1)}%</div>
        </div>
        <div style="background:${gradeHexColor}15;color:${gradeHexColor};font-size:22px;font-weight:900;padding:10px 18px;border-radius:10px;border:2px solid ${gradeHexColor}30">${g.label}</div>
      </div>

      <!-- Answers Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#1e3a5f;color:#fff">
            <th style="padding:8px;border:1px solid #2d5a9e">النتيجة</th>
            <th style="padding:8px;border:1px solid #2d5a9e">الصواب</th>
            <th style="padding:8px;border:1px solid #2d5a9e">إجابتك</th>
            <th style="padding:8px;border:1px solid #2d5a9e">السؤال</th>
            <th style="padding:8px;border:1px solid #2d5a9e;background:#172d50"></th>
            <th style="padding:8px;border:1px solid #2d5a9e">النتيجة</th>
            <th style="padding:8px;border:1px solid #2d5a9e">الصواب</th>
            <th style="padding:8px;border:1px solid #2d5a9e">إجابتك</th>
            <th style="padding:8px;border:1px solid #2d5a9e">السؤال</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>

      <!-- Footer -->
      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;border-top:2px dashed #e2e8f0;padding-top:12px">
        <div style="font-size:11px;color:#94a3b8">تاريخ التصحيح: ${new Date(r.timestamp || Date.now()).toLocaleDateString('ar-SA')}</div>
        <div style="background:#dcfce7;color:#15803d;font-weight:900;font-size:13px;padding:6px 16px;border-radius:8px;border:2px solid #86efac">✅ معتمد</div>
        <div style="font-size:11px;color:#94a3b8">نظام OMR — نخبة الشمال</div>
      </div>
    </div>`;
  }).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="UTF-8">
    <title>طباعة الكشوف المنفصلة</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; }
      @media print {
        body { background: white; }
        .no-print { display: none !important; }
        .slip { page-break-after: always; }
      }
    </style>
  </head><body>
    <div class="no-print" style="background:#1e3a5f;color:white;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:99">
      <span style="font-weight:700">🖨️ طباعة ${results.length} كشف منفصل</span>
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px">🖨️ طباعة الآن</button>
    </div>
    ${slips}
  </body></html>`);
  win.document.close();
};

/* ── Main Component ── */
const ApprovedResults = () => {
  const [allResults, setAllResults] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairReport, setRepairReport] = useState(null);
  const [editingResult, setEditingResult] = useState(null);
  const [editScore, setEditScore] = useState('');
  const [editTotal, setEditTotal] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeletedCount, setBulkDeletedCount] = useState(0);
  const [showBulkDateModal, setShowBulkDateModal] = useState(false);
  const [bulkDateValue, setBulkDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingBulkDate, setIsSavingBulkDate] = useState(false);
  const [bulkDateIndex, setBulkDateIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [results, examList] = await Promise.all([getOmrResults(), getOmrExams()]);
    const approved = results.filter(r =>
      r.approved === true ||
      r.confirmed === true ||
      r.approvedAt != null ||
      (r.studentId && r.score != null)
    );
    approved.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setAllResults(approved);
    setExams(examList);
    setLoading(false);
  };

  /* ── Repair: Re-match all saved results to students ── */
  const handleRepair = async () => {
    if (!window.confirm('سيقوم النظام بفحص جميع النتائج المحفوظة وإعادة ربطها بالطلاب تلقائياً. هل تريد المتابعة؟')) return;
    setIsRepairing(true);
    setRepairReport(null);
    try {
      const [results, students] = await Promise.all([getOmrResults(), getStudents()]);

      // Build a lookup: every possible ID → student
      const byId = {};
      students.forEach(s => {
        [
          (s.id          || '').toString().trim(),
          (s.seatNumber  || s.seat_number  || '').toString().trim(),
          (s.nationalId  || s.national_id  || '').toString().trim(),
        ].filter(Boolean).forEach(key => { byId[key] = s; });
      });

      let fixed = 0, skipped = 0;
      for (const r of results) {
        const rawId  = (r.studentId || '').toString().trim();
        const cleanId = rawId.replace(/^0+/, '');
        const found = byId[rawId] || byId[cleanId];
        if (found) {
          const alreadyOk = r.studentName && r.studentName !== 'طالب غير معروف';
          if (!alreadyOk) {
            await saveOmrResult({
              ...r,
              studentName:  found.name  || r.studentName,
              studentGrade: found.grade || found.classroom || r.studentGrade || '',
              phone:        found.phone || r.phone || '',
              systemViewImage: undefined,
              reviewRois:  undefined,
            });
            fixed++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      }
      setRepairReport({ fixed, skipped, total: results.length });
      await loadData();
    } catch (e) {
      alert('حدث خطأ أثناء الإصلاح: ' + e.message);
    } finally {
      setIsRepairing(false);
    }
  };

  /* Derived data */
  const filteredByExam = useMemo(() => {
    return selectedExamId
      ? allResults.filter(r => r.examId === selectedExamId || r.examTitle === exams.find(e => e.id === selectedExamId)?.title)
      : allResults;
  }, [allResults, selectedExamId, exams]);

  const selectedExam = useMemo(() => exams.find(e => e.id === selectedExamId), [exams, selectedExamId]);

  const filteredResults = useMemo(() => {
    return filteredByExam.filter(r => {
      const matchSearch =
        (r.studentName || '').includes(searchTerm) ||
        (r.studentId || '').includes(searchTerm) ||
        (r.examTitle || '').includes(searchTerm);

      const pct = parseFloat(r.percentage);
      const matchGrade =
        gradeFilter === 'all' ? true :
        gradeFilter === 'pass' ? pct >= 50 :
        gradeFilter === 'fail' ? pct < 50 :
        gradeFilter === 'excellent' ? pct >= 90 :
        gradeFilter === 'good' ? pct >= 70 && pct < 90 : true;

      return matchSearch && matchGrade;
    });
  }, [filteredByExam, searchTerm, gradeFilter]);
  
  // Keep selection valid as filters/data change
  useEffect(() => {
    setSelectedIds(prev => {
      const visible = new Set(filteredResults.map(r => r.id));
      const next = new Set();
      prev.forEach(id => { if (visible.has(id)) next.add(id); });
      return next;
    });
  }, [filteredResults]);

  /* Stats */
  const totalApproved = filteredByExam.length;
  const passCount = filteredByExam.filter(r => parseFloat(r.percentage) >= 50).length;
  const failCount = totalApproved - passCount;
  const avgPct = totalApproved > 0
    ? (filteredByExam.reduce((s, r) => s + parseFloat(r.percentage), 0) / totalApproved).toFixed(1)
    : '0';

  /* CSV Export */
  const exportCSV = () => {
    if (!filteredResults.length) return;
    const headers = ['الاسم', 'الرقم التعريفي', 'الصف', 'الاختبار', 'الدرجة', 'الإجمالي', 'النسبة', 'التقدير', 'التاريخ'];
    const rows = filteredResults.map(r => {
      const g = getGradeLabel(r.percentage);
      return [
        r.studentName || r.studentId,
        r.studentId,
        r.studentGrade || '',
        r.examTitle || '',
        r.score,
        r.total,
        r.percentage + '%',
        g.label,
        new Date(r.timestamp).toLocaleDateString('ar-EG'),
      ];
    });
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `كشف_المعتمدين_${selectedExam?.title || 'الكل'}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditModal = (result) => {
    setEditingResult(result);
    setEditScore(result.score ?? '');
    setEditTotal(result.total ?? '');
    setEditDate(result.timestamp ? new Date(result.timestamp).toISOString().split('T')[0] : '');
  };

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingResult(null);
    setEditScore('');
    setEditTotal('');
    setEditDate('');
  };

  const handleSaveEditedGrade = async (e) => {
    e.preventDefault();
    if (!editingResult) return;

    const parsedScore = Number(editScore);
    const parsedTotal = Number(editTotal);

    if (!Number.isFinite(parsedScore) || !Number.isFinite(parsedTotal)) {
      alert('الرجاء إدخال أرقام صحيحة للدرجة والإجمالي.');
      return;
    }
    if (parsedTotal <= 0) {
      alert('الإجمالي يجب أن يكون أكبر من صفر.');
      return;
    }
    if (parsedScore < 0 || parsedScore > parsedTotal) {
      alert('الدرجة يجب أن تكون بين 0 والإجمالي.');
      return;
    }

    const percentage = ((parsedScore / parsedTotal) * 100).toFixed(1);

    setIsSavingEdit(true);
    try {
      const newTimestamp = editDate ? new Date(editDate).toISOString() : editingResult.timestamp;
      
      await saveOmrResult({
        ...editingResult,
        score: parsedScore,
        total: parsedTotal,
        percentage,
        timestamp: newTimestamp,
      });
      await loadData();
      closeEditModal();
    } catch (error) {
      alert(`تعذر حفظ التعديل: ${error.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteResult = async (result) => {
    if (!result?.id) return;
    const name = result.studentName || result.studentId || 'هذا الطالب';
    if (!window.confirm(`هل تريد حذف نتيجة ${name} نهائيًا؟`)) return;

    setDeletingId(result.id);
    try {
      await deleteOmrResult(result.id);
      await loadData();
    } catch (error) {
      alert(`تعذر حذف النتيجة: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        filteredResults.forEach(r => { if (r.id) next.add(r.id); });
      } else {
        filteredResults.forEach(r => { if (r.id) next.delete(r.id); });
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`هل تريد حذف ${ids.length} نتيجة محددة نهائياً؟`)) return;

    setIsBulkDeleting(true);
    setBulkDeletedCount(0);
    try {
      // Delete sequentially to avoid freezing/overloading storage
      let done = 0;
      for (const id of ids) {
        await deleteOmrResult(id);
        done++;
        setBulkDeletedCount(done);
      }
      await loadData();
      setSelectedIds(new Set());
    } catch (error) {
      alert(`تعذر حذف بعض النتائج: ${error.message}`);
      await loadData();
      setSelectedIds(new Set());
    } finally {
      setIsBulkDeleting(false);
      setBulkDeletedCount(0);
    }
  };
  
  const handleBulkDateSave = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    setIsSavingBulkDate(true);
    setBulkDateIndex(0);
    try {
      let done = 0;
      for (const id of ids) {
        const original = allResults.find(r => r.id === id);
        if (original) {
          const isoDate = new Date(bulkDateValue);
          // Preserve the original time if possible, otherwise use current time
          const originalDate = new Date(original.timestamp || Date.now());
          isoDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());

          await saveOmrResult({
            ...original,
            timestamp: isoDate.toISOString(),
          });
        }
        done++;
        setBulkDateIndex(done);
      }
      await loadData();
      setSelectedIds(new Set());
      setShowBulkDateModal(false);
    } catch (error) {
      alert(`تعذر تحديث بعض التواريخ: ${error.message}`);
      await loadData();
    } finally {
      setIsSavingBulkDate(false);
      setBulkDateIndex(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
      
      {/* ── Header ── */}
      <div className="luxury-card p-8 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-white to-indigo-50/30 border-none">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 font-header leading-tight tracking-tight">كشف المعتمدين</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Approved Results Registry</p>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            عرض نتائج الطلاب المعتمدة حسب الاختبار — مع إمكانية الطباعة والتصدير
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
          >
            <RefreshCcw size={16} /> تحديث
          </button>
          <button
            onClick={handleRepair}
            disabled={isRepairing}
            title="إعادة ربط النتائج بالطلاب تلقائياً (للأوراق التي ظهرت كـ غير معروف)"
            className="flex items-center gap-2 px-5 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl font-bold text-sm hover:bg-amber-100 transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            {isRepairing ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
            {isRepairing ? 'جاري الإصلاح...' : 'إصلاح الأسماء'}
          </button>
          {repairReport && (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold">
              ✅ تم إصلاح {repairReport.fixed} نتيجة • {repairReport.skipped} موجودة مسبقاً
            </div>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
          >
            <Download size={16} /> تصدير CSV
          </button>
          {filteredResults.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => printApprovedSlips(filteredResults, selectedExam?.stage)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition-all shadow-sm active:scale-95 border border-indigo-100"
              >
                <FileText size={18} /> كشوف منفصلة
              </button>
              <button
                onClick={() => printApprovedList(filteredResults, selectedExam?.title || 'جميع الاختبارات', selectedExam?.stage)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                <Printer size={18} /> كشف مجمع ({filteredResults.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Exam Selector ── */}
      <div className="luxury-card p-6 bg-white border-none">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={18} className="text-indigo-500" />
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">اختر الاختبار</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedExamId('')}
            className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border
              ${!selectedExamId
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
          >
            جميع الاختبارات
            <span className="mr-2 text-[10px] opacity-70">({allResults.length})</span>
          </button>
          {exams.map(exam => {
            const examResults = allResults.filter(r => r.examId === exam.id || r.examTitle === exam.title);
            return (
              <button
                key={exam.id}
                onClick={() => setSelectedExamId(exam.id)}
                className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border
                  ${selectedExamId === exam.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
              >
                {exam.title}
                <span className="mr-2 text-[10px] opacity-70">({examResults.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats Row ── */}
      {totalApproved > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي المعتمدين', value: totalApproved, icon: <Users size={20}/>, color: 'indigo', desc: 'طالب مُعتمَد' },
            { label: 'الناجحون', value: passCount, icon: <CheckCircle2 size={20}/>, color: 'emerald', desc: `${totalApproved > 0 ? ((passCount/totalApproved)*100).toFixed(0) : 0}% من الإجمالي` },
            { label: 'الراسبون', value: failCount, icon: <AlertCircle size={20}/>, color: 'rose', desc: `${totalApproved > 0 ? ((failCount/totalApproved)*100).toFixed(0) : 0}% من الإجمالي` },
            { label: 'متوسط الدرجات', value: avgPct + '%', icon: <TrendingUp size={20}/>, color: 'blue', desc: 'متوسط النسب المئوية' },
          ].map((stat, i) => (
            <div key={i} className={`luxury-card p-5 bg-white border-none relative overflow-hidden group`}>
              <div className={`absolute top-0 right-0 w-16 h-16 bg-${stat.color}-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60 group-hover:scale-150 transition-transform duration-700`}></div>
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center mb-3 relative z-10`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-black text-slate-900 font-header relative z-10">{stat.value}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 relative z-10">{stat.label}</div>
              <div className="text-[10px] font-bold text-slate-300 mt-0.5 relative z-10">{stat.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters & Search ── */}
      <div className="luxury-card p-5 bg-white border-none flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="بحث بالاسم أو الرقم التعريفي..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-slate-400" />
          {[
            { key: 'all', label: 'الكل' },
            { key: 'pass', label: '✅ ناجح' },
            { key: 'fail', label: '❌ راسب' },
            { key: 'excellent', label: '⭐ ممتاز ≥90%' },
            { key: 'good', label: '👍 جيد ≥70%' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setGradeFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border
                ${gradeFilter === f.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results Table ── */}
      <div className="luxury-card overflow-hidden border-none bg-white">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-300">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="font-black text-sm">جاري تحميل البيانات...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-300">
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-5 border border-dashed border-slate-200">
              <ClipboardList size={36} className="opacity-30" />
            </div>
            <p className="font-black text-lg tracking-tight text-slate-400">
              {allResults.length === 0 ? 'لا توجد نتائج معتمدة بعد' : 'لا توجد نتائج تطابق الفلاتر المحددة'}
            </p>
            <p className="text-sm font-medium mt-2 text-slate-300">
              {allResults.length === 0
                ? 'قم باعتماد النتائج من صفحة التصحيح الآلي أولاً'
                : 'جرب تغيير خيارات البحث أو الفلتر'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Table header info */}
            <div className="px-8 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                نتائج معتمدة • {filteredResults.length} سجل
              </span>
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBulkDateModal(true)}
                      disabled={isBulkDeleting || isSavingBulkDate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 font-black text-xs hover:bg-indigo-100 transition-all disabled:opacity-60"
                      title="تغيير التاريخ للمحدد"
                    >
                      <Calendar size={16} />
                      تغيير التاريخ ({selectedIds.size})
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isBulkDeleting || isSavingBulkDate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 transition-all disabled:opacity-60"
                      title="حذف النتائج المحددة"
                    >
                      <Trash2 size={16} />
                      {isBulkDeleting ? `جاري حذف ${bulkDeletedCount}/${selectedIds.size}` : `حذف المحدد (${selectedIds.size})`}
                    </button>
                  </div>
                )}
                <span className="text-xs font-bold text-indigo-500">
                  {selectedExam ? `اختبار: ${selectedExam.title}` : 'جميع الاختبارات'}
                </span>
              </div>
            </div>
            <table className="premium-table w-full text-right">
              <thead>
                <tr className="border-none text-slate-400 text-[11px] uppercase tracking-widest font-black">
                  <th className="text-center px-4 py-4 w-14">
                    <input
                      type="checkbox"
                      aria-label="تحديد الكل"
                      disabled={filteredResults.length === 0 || isBulkDeleting}
                      checked={filteredResults.length > 0 && filteredResults.every(r => selectedIds.has(r.id))}
                      onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </th>
                  <th className="text-center px-5 py-4">#</th>
                  <th className="text-right px-5 py-4">الطالب</th>
                  <th className="text-center px-5 py-4">الصف</th>
                  <th className="text-right px-5 py-4">الاختبار</th>
                  <th className="text-center px-5 py-4">الدرجة</th>
                  <th className="text-center px-5 py-4">النسبة</th>
                  <th className="text-center px-5 py-4">التقدير</th>
                  <th className="text-center px-5 py-4">التاريخ</th>
                  <th className="text-center px-5 py-4">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredResults.map((res, idx) => {
                  const g = getGradeLabel(res.percentage);
                  const pct = parseFloat(res.percentage).toFixed(1);
                  const isPass = parseFloat(res.percentage) >= 50;
                  const isChecked = selectedIds.has(res.id);
                  return (
                    <tr key={res.id} className="hover:bg-indigo-50/20 transition-colors group">
                      <td className="text-center px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`تحديد ${res.studentName || res.studentId}`}
                          disabled={isBulkDeleting}
                          checked={isChecked}
                          onChange={() => toggleSelected(res.id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="w-12 text-center px-5 py-4">
                        <span className="text-sm font-black text-slate-300">{idx + 1}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border shrink-0
                            ${isPass ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                            {(res.studentName || res.studentId || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-black text-slate-800 text-sm">{res.studentName || '—'}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {res.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {res.studentGrade || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-indigo-400 shrink-0" />
                          <span className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{res.examTitle || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-xl font-black font-header ${isPass ? 'text-indigo-700' : 'text-rose-600'}`}>
                            {res.score}<span className="text-xs opacity-30 mx-0.5">/</span>{res.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-sm font-black ${g.color}`}>{pct}%</span>
                          <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${g.dot}`}
                              style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black border ${g.bg} ${g.color} ${g.border}`}>
                          {g.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="text-[11px] font-bold text-slate-400">
                          {new Date(res.timestamp).toLocaleDateString('ar-EG')}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          {new Date(res.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(res)}
                            disabled={isBulkDeleting}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-all text-xs font-black"
                            title="تعديل درجة الطالب"
                          >
                            <Edit2 size={14} />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteResult(res)}
                            disabled={deletingId === res.id || isBulkDeleting}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 transition-all text-xs font-black disabled:opacity-60"
                            title="حذف النتيجة"
                          >
                            <Trash2 size={14} />
                            {deletingId === res.id ? 'جاري الحذف...' : 'حذف'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Distribution Chart ── */}
      {filteredResults.length > 0 && (
        <div className="luxury-card p-8 bg-white border-none">
          <div className="flex items-center gap-3 mb-6">
            <Star size={18} className="text-amber-500" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">توزيع التقديرات</h3>
          </div>
          <div className="flex gap-4 flex-wrap">
            {[
              { label: 'ممتاز', min: 90, max: 100, color: 'emerald' },
              { label: 'جيد جداً', min: 80, max: 90, color: 'blue' },
              { label: 'جيد', min: 70, max: 80, color: 'violet' },
              { label: 'مقبول', min: 60, max: 70, color: 'amber' },
              { label: 'ضعيف', min: 0, max: 60, color: 'rose' },
            ].map(band => {
              const count = filteredResults.filter(r => {
                const p = parseFloat(r.percentage);
                return p >= band.min && p < band.max;
              }).length;
              const pct = filteredResults.length > 0 ? ((count / filteredResults.length) * 100).toFixed(0) : 0;
              return (
                <div key={band.label} className={`flex-1 min-w-[120px] p-4 rounded-2xl bg-${band.color}-50 border border-${band.color}-100 text-center`}>
                  <div className={`text-2xl font-black text-${band.color}-700 font-header`}>{count}</div>
                  <div className={`text-xs font-black text-${band.color}-600 mt-1`}>{band.label}</div>
                  <div className={`text-[10px] font-bold text-${band.color}-400 mt-0.5`}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingResult && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">تعديل درجة الطالب</h3>
                <p className="text-xs text-indigo-100 mt-1">{editingResult.studentName || editingResult.studentId}</p>
              </div>
              <button
                onClick={closeEditModal}
                disabled={isSavingEdit}
                className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedGrade} className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الدرجة</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editScore}
                      onChange={(e) => setEditScore(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الإجمالي</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={editTotal}
                      onChange={(e) => setEditTotal(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الاعتماد</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                    required
                  />
                </div>

                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  سيتم تحديث الدرجة والتاريخ والنسبة والتقدير تلقائياً بعد الحفظ.
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all disabled:opacity-60"
                >
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSavingEdit}
                  className="px-5 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Date Edit Modal ── */}
      {showBulkDateModal && (
        <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-none text-right">
             <div className="px-8 py-6 bg-indigo-600 text-white flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black font-header">تغيير تاريخ الاعتماد للمحدد</h3>
                   <p className="text-xs text-indigo-100 mt-1">تحديث {selectedIds.size} سجل دفعة واحدة</p>
                </div>
                <button onClick={() => !isSavingBulkDate && setShowBulkDateModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
             </div>
             <div className="p-8 space-y-6">
                <div className="space-y-3">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">اختر التاريخ الجديد</label>
                   <input 
                      type="date" 
                      value={bulkDateValue}
                      onChange={e => setBulkDateValue(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 text-center focus:bg-white focus:ring-8 focus:ring-indigo-50 transition-all"
                   />
                </div>
                
                {isSavingBulkDate && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-indigo-600">جاري التحديث...</span>
                      <span className="text-slate-400">{bulkDateIndex} / {selectedIds.size}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-300" 
                        style={{ width: `${(bulkDateIndex / selectedIds.size) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                   <button 
                      onClick={() => setShowBulkDateModal(false)} 
                      disabled={isSavingBulkDate}
                      className="px-8 py-4 bg-white text-slate-400 rounded-2xl font-black border border-slate-100 hover:bg-slate-50 transition-all shadow-sm"
                   >
                      تراجع
                   </button>
                   <button 
                      onClick={handleBulkDateSave}
                      disabled={isSavingBulkDate || !bulkDateValue}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all disabled:opacity-40"
                   >
                      {isSavingBulkDate ? 'جاري الحفظ...' : `تحديث ${selectedIds.size} سجل`}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovedResults;

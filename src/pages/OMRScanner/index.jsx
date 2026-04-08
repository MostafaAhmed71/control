import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, FileImage, CheckCircle, AlertCircle, Loader2, ListFilter, X, BadgeCheck, Trash2, ChevronDown, ChevronUp, Edit3, MessageCircle, ScanLine, Wifi, WifiOff, Printer, Eye } from 'lucide-react';
import { getOmrExams, saveOmrResult, getStudents, OMR_API_BASE, WHATSAPP_API_BASE } from '../../utils/dataService';

const STAGES = {
  'ابتدائي': ['الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي'],
  'متوسط': ['الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط'],
  'ثانوي': ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'],
};

const getSchoolNameByStage = (stage = '') => {
  const s = String(stage || '').trim();
  if (s === 'ابتدائي' || s === 'الابتدائي') {
    return 'مدارس نخبة الشمال الأهلية والعالمية';
  }
  return 'متوسطة وثانوية نخبة الشمال الأهلية';
};

/* ── Helpers ── */
const grade = (scanned, keys) => {
  let score = 0;
  const details = {};
  const qs = Object.keys(keys);
  qs.forEach(q => {
    const correct = keys[q];
    const got = scanned[q] || '';
    const ok = got === correct;
    if (ok) score++;
    details[q] = { student_answer: got, correct_option: correct, is_correct: ok };
  });
  return { score, total: qs.length, percentage: qs.length > 0 ? ((score / qs.length) * 100).toFixed(2) : '0', details };
};

/* ── Print Result Slip ── */
const printResultSlip = (items, exam) => {
  const confirmed = Array.isArray(items) ? items : [items];
  if (!confirmed.length) return;
  const schoolName = getSchoolNameByStage(exam?.stage);

  const getLetterAr = (l) => ({ A: 'أ', B: 'ب', C: 'ج', D: 'د' }[l] || l || '—');
  const getGradeLabel = (pct) => {
    const p = parseFloat(pct);
    if (p >= 90) return { label: 'ممتاز', color: '#16a34a' };
    if (p >= 80) return { label: 'جيد جداً', color: '#2563eb' };
    if (p >= 70) return { label: 'جيد', color: '#7c3aed' };
    if (p >= 60) return { label: 'مقبول', color: '#d97706' };
    return { label: 'ضعيف', color: '#dc2626' };
  };

  const slips = confirmed.map(item => {
    const r = item.result;
    const g = getGradeLabel(r.percentage);
    const details = r.details || {};
    const qs = Object.keys(details).sort((a, b) => parseInt(a) - parseInt(b));

    // Split questions into two columns (Q1-15 right, Q16-30 left — RTL)
    const col1 = qs.filter(q => parseInt(q) <= 15);
    const col2 = qs.filter(q => parseInt(q) > 15);
    const maxRows = Math.max(col1.length, col2.length);

    const rows = Array.from({ length: maxRows }, (_, i) => {
      const q1 = col1[i]; const q2 = col2[i];
      const d1 = q1 ? details[q1] : null;
      const d2 = q2 ? details[q2] : null;
      return { q1, d1, q2, d2 };
    });

    const tableRows = rows.map(({ q1, d1, q2, d2 }) => `
      <tr>
        ${q2 ? `
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold;color:${d2.is_correct ? '#15803d' : '#dc2626'}">${d2.is_correct ? '✓' : '✗'}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center">${getLetterAr(d2.correct_option)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold">${getLetterAr(d2.student_answer)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;background:#f8fafc;font-weight:bold;color:#1e293b">${q2}</td>
        ` : '<td colspan="4" style="border:1px solid #e5e7eb"></td>'}
        <td style="border:1px solid #e5e7eb;width:20px;background:#f1f5f9"></td>
        ${q1 ? `
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold;color:${d1.is_correct ? '#15803d' : '#dc2626'}">${d1.is_correct ? '✓' : '✗'}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center">${getLetterAr(d1.correct_option)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-weight:bold">${getLetterAr(d1.student_answer)}</td>
          <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:center;background:#f8fafc;font-weight:bold;color:#1e293b">${q1}</td>
        ` : '<td colspan="4" style="border:1px solid #e5e7eb"></td>'}
      </tr>`);

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
        <div><span style="color:#64748b;font-size:12px">اسم الطالب</span><br><strong style="font-size:15px;color:#1e293b">${r.studentName}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الصف</span><br><strong style="font-size:14px;color:#1e293b">${r.studentGrade || '—'}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الاختبار</span><br><strong style="font-size:13px;color:#1e293b">${r.examTitle || exam?.title || '—'}</strong></div>
        <div><span style="color:#64748b;font-size:12px">الرقم التعريفي</span><br><strong style="font-size:13px;color:#475569;font-family:monospace">${r.studentId}</strong></div>
      </div>

      <!-- Score Visual -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;background:#fff;border:2px solid ${g.color}22;border-radius:12px;padding:14px 20px">
        <div style="font-size:42px;font-weight:900;color:${g.color};line-height:1">${r.score}<span style="font-size:18px;color:#94a3b8">/${r.total}</span></div>
        <div style="flex:1">
          <div style="background:#f1f5f9;border-radius:999px;height:10px;overflow:hidden">
            <div style="height:100%;width:${r.percentage}%;background:${g.color};border-radius:999px"></div>
          </div>
          <div style="margin-top:6px;font-size:13px;color:${g.color};font-weight:700">${g.label} — ${parseFloat(r.percentage).toFixed(1)}%</div>
        </div>
        <div style="background:${g.color}15;color:${g.color};font-size:22px;font-weight:900;padding:10px 18px;border-radius:10px;border:2px solid ${g.color}30">${g.label}</div>
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
        <tbody>${tableRows.join('')}</tbody>
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
    <title>نتائج الاختبار</title>
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
      <span style="font-weight:700">🖨️ طباعة ${confirmed.length} نتيجة</span>
      <button onclick="window.print()" style="background:#2563eb;color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px">🖨️ طباعة الآن</button>
    </div>
    ${slips}
  </body></html>`);
  win.document.close();
};

const scanImage = async (file, template = 'default', numQuestions = 30, scanMode = 'hybrid') => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${OMR_API_BASE}/scan?template=${template}&num_questions=${numQuestions}&scan_mode=${scanMode}`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'فشل المسح');
  }
  return res.json();
};

const revokePreviewUrl = (url) => {
  if (!url || typeof url !== 'string') return;
  if (url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
};

/* ── Card for a single scanned sheet ── */
const SheetCard = ({ item, onConfirm, onUnconfirm, onRemove, onAnswerEdit, onSendWhatsapp, onPrint, exam }) => {
  const [expanded, setExpanded] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewMode, setPreviewMode] = useState('system');
  const isConfirmed = item.confirmed;
  const reviewCount = item.result?.needsReviewQuestions?.length || 0;
  const decision = item.result?.decisionStatus || 'REVIEW_REQUIRED';
  const isRejected = decision === 'REJECTED_QUALITY';
  const mismatchWarning = item.result?.qualityFlags?.includes('num_questions_mismatch');
  const lowQualityWarning = item.result?.qualityFlags?.includes('quality_gate_reject');

  return (
    <div className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-sm
      ${isConfirmed ? 'border-green-200 bg-green-50/30' : item.error ? 'border-red-100' : 'border-gray-100 hover:border-indigo-200'}`}>

      {/* Card Header */}
      <div className="p-5 flex items-center gap-4">
        {/* Status Icon */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
          ${isConfirmed ? 'bg-green-100 text-green-600' : item.error ? 'bg-red-100 text-red-500' : item.fromScanner ? 'bg-teal-50 text-teal-600' : 'bg-indigo-50 text-indigo-600'}`}>
          {item.loading ? <Loader2 size={20} className="animate-spin" /> :
            isConfirmed ? <BadgeCheck size={22} /> :
              item.error ? <AlertCircle size={20} /> :
                item.fromScanner ? <ScanLine size={20} /> :
                  <FileImage size={20} />}
        </div>

        {/* Student Info */}
        <div className="flex-1 min-w-0">
          <div className="font-black text-gray-800 truncate flex items-center gap-2">
            {item.result?.studentName || (item.fromScanner ? `ورقة مسح ${item.page || ''}` : item.file?.name || 'ورقة')}
            {item.fromScanner && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-md border border-teal-100">سكانر</span>
            )}
          </div>
          {item.result && (
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              {item.result.studentGrade && <span className="ml-2">{item.result.studentGrade}</span>}
              ID: {item.result.studentId}
            </div>
          )}
          {item.result && !item.error && (
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                decision === 'AUTO_ACCEPTED'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : decision === 'REJECTED_QUALITY'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {decision === 'AUTO_ACCEPTED' ? 'جاهز اعتماد تلقائي' : decision === 'REJECTED_QUALITY' ? 'مرفوض جودة' : 'يتطلب مراجعة'}
              </span>
            </div>
          )}
          {item.result && !item.error && reviewCount > 0 && (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold">
                <AlertCircle size={11} />
                يحتاج مراجعة: {reviewCount} سؤال
              </span>
            </div>
          )}
          {item.result && !item.error && mismatchWarning && (
            <div className="mt-1 text-xs text-red-600 font-bold">
              عدم تطابق نوع النموذج: الورقة ليست بنفس عدد أسئلة الاختبار المختار.
            </div>
          )}
          {item.result && !item.error && lowQualityWarning && (
            <div className="mt-1 text-xs text-red-600 font-bold">
              جودة الصورة منخفضة جدًا للتصحيح الآمن. أعد المسح بوضوح أعلى.
            </div>
          )}
          {item.error && <div className="text-xs text-red-500 font-medium mt-0.5 truncate">{item.error}</div>}
        </div>

        {/* Score Badge */}
        {item.result && !item.error && (
          <div className="text-center shrink-0">
            <div className={`text-xl font-black ${parseFloat(item.result.percentage) >= 50 ? 'text-green-600' : 'text-red-500'}`}>
              {item.result.score}/{item.result.total}
            </div>
            <div className="text-xs text-gray-400">{item.result.percentage}%</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {item.result && !item.error && !isConfirmed && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
          {item.result && !item.error && !isConfirmed && !isRejected && (
            <button type="button" onClick={() => onConfirm(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm
                ${reviewCount > 0
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                  : 'bg-green-600 hover:bg-green-700 shadow-green-200'}`}>
              <BadgeCheck size={15} /> اعتماد
            </button>
          )}
          {isConfirmed && (
            <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl text-xs font-bold">
              <CheckCircle size={14} /> تم الاعتماد
            </span>
          )}
          {isConfirmed && (
            <button
              type="button"
              onClick={() => onUnconfirm(item.id)}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all"
              title="إلغاء الاعتماد مع سبب"
            >
              إلغاء اعتماد
            </button>
          )}
          {item.result && !item.error && isConfirmed && (
            <button type="button" onClick={() => onPrint(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-200"
              title="طباعة النتيجة">
              <Printer size={14} /> طباعة
            </button>
          )}
          {(item.previewUrl || item.result?.systemViewImage) && (
            <button
              type="button"
              onClick={() => {
                setPreviewMode(item.result?.systemViewImage ? 'system' : 'original');
                setShowImagePreview(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              title="عرض صورة ورقة الطالب"
            >
              <Eye size={14} /> رؤية النظام
            </button>
          )}
          {item.result && !item.error && isConfirmed && item.result.phone && (
            <button type="button" onClick={() => onSendWhatsapp(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-200"
              title={`إرسال إلى ${item.result.phone}`}>
              <MessageCircle size={14} /> واتساب
            </button>
          )}
          <button type="button" onClick={() => onRemove(item.id)}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expandable Answer Grid */}
      {expanded && item.result && !item.error && (
        <div className="border-t border-gray-100 p-4 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">تفاصيل الإجابات</h4>
            <div className="flex items-center gap-2">
              {reviewCount > 0 && (
                <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                  <AlertCircle size={11} /> أسئلة تحتاج مراجعة: {reviewCount}
                </span>
              )}
              <span className="text-xs text-indigo-500 font-bold flex items-center gap-1">
                <Edit3 size={11} /> اضغط على الإجابة لتعديلها
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
            {Object.entries(item.result.details).map(([q, ans]) => (
              <div key={q} className="relative group/cell">
                {editingAnswer === q ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[10px] text-center text-gray-400 font-bold">Q{q}</div>
                    <select autoFocus
                      className="w-full text-center p-1 text-xs font-bold rounded-lg border-2 border-indigo-400 bg-white"
                      defaultValue={ans.student_answer}
                      onChange={e => { onAnswerEdit(item.id, q, e.target.value); setEditingAnswer(null); }}
                      onBlur={() => setEditingAnswer(null)}>
                      <option value="">-</option>
                      {['A', 'B', 'C', 'D'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ) : (
                  (() => {
                    const qNum = parseInt(q, 10);
                    const isReview = item.result?.needsReviewQuestions?.includes(qNum);
                    const qConfidence = item.result?.confidence?.[q];
                    return (
                  <button type="button" onClick={() => !isConfirmed && !isRejected && setEditingAnswer(q)}
                    className={`w-full p-2 rounded-xl text-center font-bold text-xs transition-all border
                      ${isReview
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : ans.is_correct
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-red-50 text-red-700 border-red-100'}
                      ${!isConfirmed ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}>
                    <div className="text-[9px] opacity-60">Q{q}</div>
                    <div className="text-sm font-black">
                      {exam?.template === 'elite'
                        ? (ans.student_answer === 'A' ? 'أ' : ans.student_answer === 'B' ? 'ب' : ans.student_answer === 'C' ? 'ج' : ans.student_answer === 'D' ? 'د' : ans.student_answer || '?')
                        : (ans.student_answer || '?')}
                    </div>
                    {!ans.is_correct && exam?.keys?.[q] && (
                      <div className="text-[9px] text-green-600 opacity-80">
                        ✓ {exam?.template === 'elite'
                          ? (exam.keys[q] === 'A' ? 'أ' : exam.keys[q] === 'B' ? 'ب' : exam.keys[q] === 'C' ? 'ج' : exam.keys[q] === 'D' ? 'د' : exam.keys[q])
                          : exam.keys[q]}
                      </div>
                    )}
                    {typeof qConfidence === 'number' && (
                      <div className={`text-[9px] mt-0.5 ${isReview ? 'text-amber-700' : 'text-gray-500'}`}>
                        ثقة: {(qConfidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </button>
                    );
                  })()
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showImagePreview && (item.previewUrl || item.result?.systemViewImage) && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowImagePreview(false)}>
          <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowImagePreview(false)}
              className="absolute top-3 left-3 z-10 p-2 bg-black/70 text-white rounded-xl hover:bg-black/85"
            >
              <X size={18} />
            </button>
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode('system')}
                disabled={!item.result?.systemViewImage}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  previewMode === 'system'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/90 text-slate-700'
                } disabled:opacity-50`}
              >
                رؤية النظام
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('original')}
                disabled={!item.previewUrl}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  previewMode === 'original'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/90 text-slate-700'
                } disabled:opacity-50`}
              >
                الأصل
              </button>
            </div>
            <img
              src={(previewMode === 'system' && item.result?.systemViewImage) ? item.result.systemViewImage : item.previewUrl}
              alt={previewMode === 'system' ? 'رؤية النظام' : 'ورقة الطالب'}
              className="block max-w-full max-h-[90vh] object-contain bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Scanner Pages Modal ── */
const ScannerModal = ({ show, onClose, onScan, scannerAvailable, scannerNames, onRefresh }) => {
  const [pages, setPages] = useState(1);
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    await onScan(pages);
    setScanning(false);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-teal-600 to-emerald-600 text-white flex justify-between items-center rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <ScanLine size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">مسح بالسكانر</h3>
              <p className="text-teal-100 text-xs">التصحيح الآلي الفوري</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Scanner status */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3
            ${scannerAvailable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-100'}`}>
            {scannerAvailable
              ? <Wifi size={18} className="text-emerald-600 shrink-0" />
              : <WifiOff size={18} className="text-red-400 shrink-0" />}
            <div className="flex-1">
              <p className={`font-bold text-sm ${scannerAvailable ? 'text-emerald-800' : 'text-red-500'}`}>
                {scannerAvailable ? `سكانر متصل: ${scannerNames[0] || 'جهاز مسح ضوئي'}` : 'لا يوجد سكانر متصل'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {scannerAvailable
                  ? 'ضع أوراق الإجابة في السكانر ثم اضغط بدء المسح'
                  : 'تأكد من توصيل السكانر وتشغيله'}
              </p>
            </div>
            {!scannerAvailable && (
              <button type="button" onClick={onRefresh}
                className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 shrink-0">
                فحص
              </button>
            )}
          </div>

          {/* Page count */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">عدد الأوراق للمسح</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[1, 2, 3, 5, 10, 15, 20, 30].map(n => (
                <button type="button" key={n} onClick={() => setPages(n)}
                  className={`w-12 h-10 rounded-xl font-bold text-sm transition-all border
                    ${pages === n
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-100'
                      : 'bg-slate-50 text-gray-600 border-gray-200 hover:border-teal-300'}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={200} value={pages}
                onChange={e => setPages(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 h-10 px-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm text-center focus:ring-2 focus:ring-teal-400" />
              <span className="text-sm text-gray-400 font-medium">{pages === 1 ? 'ورقة واحدة' : `${pages} أوراق`}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3">
          <button type="button" onClick={onClose}
            className="px-5 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
            إلغاء
          </button>
          <button type="button" onClick={handleScan}
            disabled={!scannerAvailable || scanning}
            className={`flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all
              ${!scannerAvailable || scanning
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200'}`}>
            {scanning
              ? <><Loader2 size={18} className="animate-spin" /> جاري المسح...</>
              : <><ScanLine size={18} /> بدء المسح ({pages} {pages === 1 ? 'ورقة' : 'أوراق'})</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Main Page ── */
const OMRScanner = () => {
  const [items, setItems] = useState([]);
  const [exams, setExams] = useState([]);
  const [filterStage, setFilterStage] = useState('All');
  const [filterGrade, setFilterGrade] = useState('All');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState([]);
  const inputRef = useRef();
  const nextId = useRef(1);

  /* Scanner state */
  const [scannerAvailable, setScannerAvailable] = useState(null);
  const [scannerNames, setScannerNames]         = useState([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isScannerScanning, setIsScannerScanning] = useState(false);
  const [scanMode, setScanMode] = useState('hybrid');
  const [batchTimer, setBatchTimer] = useState({
    running: false,
    startedAt: null,
    elapsedMs: 0,
    lastBatchMs: null,
    lastBatchCount: 0,
  });

  useEffect(() => {
    (async () => {
      const [examsData, studentsData] = await Promise.all([getOmrExams(), getStudents()]);
      setExams(examsData);
      setStudents(studentsData);
      if (examsData.length > 0) setSelectedExamId(examsData[0].id);
    })();
    checkScanner();
  }, []);

  useEffect(() => {
    if (!batchTimer.running || !batchTimer.startedAt) return undefined;
    const t = setInterval(() => {
      setBatchTimer(prev => ({
        ...prev,
        elapsedMs: Date.now() - prev.startedAt,
      }));
    }, 250);
    return () => clearInterval(t);
  }, [batchTimer.running, batchTimer.startedAt]);

  /* ── Check scanner ── */
  const checkScanner = async () => {
    setScannerAvailable(null);
    try {
      const res = await fetch(`${OMR_API_BASE}/scanner-status`);
      if (res.ok) {
        const data = await res.json();
        setScannerAvailable(data.available);
        setScannerNames(data.scanners || []);
      } else {
        setScannerAvailable(false);
      }
    } catch {
      setScannerAvailable(false);
    }
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);
  const filterGrades = filterStage !== 'All' ? STAGES[filterStage] || [] : [];
  const visibleExams = useMemo(() => exams.filter(e => {
    if (filterStage !== 'All' && e.stage !== filterStage) return false;
    if (filterGrade !== 'All' && e.grade !== filterGrade) return false;
    return true;
  }), [exams, filterStage, filterGrade]);

  // Auto-select first exam when filter changes and current selection is not in visible list
  useEffect(() => {
    if (visibleExams.length > 0) {
      const isCurrentVisible = visibleExams.some(e => e.id === selectedExamId);
      if (!isCurrentVisible) {
        setSelectedExamId(visibleExams[0].id);
      }
    } else {
      setSelectedExamId('');
    }
  }, [visibleExams]);

  /* ── Process a single file through OMR engine ── */
  const processFile = async (file, itemId, extraProps = {}) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, loading: true, error: null } : it));
    try {
      const omrData = await scanImage(file, selectedExam?.template || 'default', selectedExam?.qCount || 30, scanMode);
      const { score, total, percentage, details } = grade(omrData.answers, selectedExam?.keys || {});
      const cleanId = omrData.student_id?.replace(/^0+/, '');
      const student = students.find(s => s.id.toString() === cleanId || s.id.toString() === omrData.student_id);
      const result = {
        examId: selectedExamId,
        examTitle: selectedExam?.title || '',
        studentId: omrData.student_id,
        studentName: student?.name || 'طالب غير معروف',
        studentGrade: student ? (student.grade || student.classroom || '') : '',
        phone: student?.phone || '',
        score, total, percentage, details,
        confidence: omrData.confidence || {},
        needsReviewQuestions: omrData.needs_review_questions || [],
        adaptiveThresholds: omrData.adaptive_thresholds || {},
        decisionStatus: omrData.decision_status || 'REVIEW_REQUIRED',
        qualityFlags: omrData.quality_flags || [],
        detectedNumQuestions: omrData.detected_num_questions ?? null,
        qualityScore: omrData.quality_score ?? 0,
        unstableQuestions: omrData.unstable_questions || [],
        averageConfidence: omrData.average_confidence || 0,
        mismatchQuestions: omrData.double_pass_mismatch_questions || [],
        systemViewImage: omrData.system_view_image || '',
        audit: [{ action: 'scan', at: new Date().toISOString(), note: 'initial scan' }],
        timestamp: new Date().toISOString()
      };
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, loading: false, result, ...extraProps } : it));
    } catch (err) {
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, loading: false, error: err.message } : it));
    }
  };

  /* ── Handle file upload (existing) ── */
  const handleFiles = async (files) => {
    if (!selectedExamId) { alert('اختر الاختبار أولاً'); return; }
    const newItems = Array.from(files).map(file => ({
      id: nextId.current++,
      file,
      previewUrl: URL.createObjectURL(file),
      loading: false,
      result: null,
      error: null,
      confirmed: false,
      fromScanner: false,
    }));
    const batchStart = Date.now();
    setBatchTimer({
      running: true,
      startedAt: batchStart,
      elapsedMs: 0,
      lastBatchMs: batchTimer.lastBatchMs,
      lastBatchCount: batchTimer.lastBatchCount,
    });
    setItems(prev => [...prev, ...newItems]);
    await Promise.all(newItems.map(item => processFile(item.file, item.id)));
    const spent = Date.now() - batchStart;
    setBatchTimer({
      running: false,
      startedAt: null,
      elapsedMs: spent,
      lastBatchMs: spent,
      lastBatchCount: newItems.length,
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
  };

  /* ── Handle hardware scanner — STREAMING (results appear one by one) ── */
  const handleHardwareScan = async (pages) => {
    if (!selectedExamId) { alert('اختر الاختبار أولاً'); return; }
    setIsScannerScanning(true);
    let received = 0;

    try {
      const res = await fetch(
        `${OMR_API_BASE}/scan-from-scanner-stream?template=${selectedExam?.template || 'default'}&pages=${pages}&num_questions=${selectedExam?.qCount || 30}&scan_mode=${scanMode}`,
        { method: 'POST' }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'خطأ غير معروف' }));
        alert(`خطأ: ${err.detail}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (NDJSON)
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);

            if (msg.type === 'result') {
              const omrData = msg.data;
              received++;
              const { score, total, percentage, details } = grade(omrData.answers || {}, selectedExam?.keys || {});
              const cleanId = omrData.student_id?.replace(/^0+/, '');
              const student = students.find(s =>
                s.id.toString() === cleanId || s.id.toString() === omrData.student_id
              );
              const newItem = {
                id: nextId.current++,
                file: null,
                loading: false,
                fromScanner: true,
                page: omrData.page || received,
                result: {
                  examId: selectedExamId,
                  examTitle: selectedExam?.title || '',
                  studentId: omrData.student_id,
                  studentName: student?.name || 'طالب غير معروف',
                  studentGrade: student ? (student.grade || student.classroom || '') : '',
                  phone: student?.phone || '',
                  score, total, percentage, details,
                  confidence: omrData.confidence || {},
                  needsReviewQuestions: omrData.needs_review_questions || [],
                  adaptiveThresholds: omrData.adaptive_thresholds || {},
                  decisionStatus: omrData.decision_status || 'REVIEW_REQUIRED',
                  qualityFlags: omrData.quality_flags || [],
                  detectedNumQuestions: omrData.detected_num_questions ?? null,
                  qualityScore: omrData.quality_score ?? 0,
                  unstableQuestions: omrData.unstable_questions || [],
                  averageConfidence: omrData.average_confidence || 0,
                  mismatchQuestions: omrData.double_pass_mismatch_questions || [],
                  systemViewImage: omrData.system_view_image || '',
                  audit: [{ action: 'scan', at: new Date().toISOString(), note: 'scanner stream scan' }],
                  timestamp: new Date().toISOString()
                },
                error: null,
                confirmed: false,
              };
              setItems(prev => [...prev, newItem]);

            } else if (msg.type === 'error') {
              const errItem = {
                id: nextId.current++,
                file: null,
                loading: false,
                fromScanner: true,
                page: null,
                result: null,
                error: msg.msg,
                confirmed: false,
              };
              setItems(prev => [...prev, errItem]);

            } else if (msg.type === 'done') {
              // streaming complete
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (e) {
      alert(`فشل الاتصال بالسكانر: ${e.message}`);
    } finally {
      setIsScannerScanning(false);
    }
  };

  /* ── Confirm / remove / etc. ── */
  const handleConfirm = async (itemId) => {
    const item = items.find(it => it.id === itemId);
    if (!item?.result) return;
    const reviewCount = item.result.needsReviewQuestions?.length || 0;
    if (item.result.decisionStatus === 'REJECTED_QUALITY') {
      alert('لا يمكن اعتماد هذه الورقة: الحالة مرفوضة جودة. أعد المسح أو راجع الصورة الأصلية.');
      return;
    }
    if (reviewCount > 0) {
      const ok = window.confirm(`هذه الورقة تحتوي ${reviewCount} سؤال بحاجة لمراجعة. هل تريد الاعتماد رغم ذلك؟`);
      if (!ok) return;
    }
    const approved = {
      ...item.result,
      approvedAt: new Date().toISOString(),
      audit: [...(item.result.audit || []), { action: 'approve', at: new Date().toISOString(), note: 'manager approved result' }],
    };
    await saveOmrResult(approved);
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, confirmed: true, result: approved } : it));
  };

  const handleUnconfirm = (itemId) => {
    const reason = window.prompt('سبب إلغاء الاعتماد (إلزامي):');
    if (!reason || !reason.trim()) return;
    setItems(prev => prev.map(it => {
      if (it.id !== itemId || !it.result) return it;
      return {
        ...it,
        confirmed: false,
        result: {
          ...it.result,
          unapprovedAt: new Date().toISOString(),
          unapproveReason: reason.trim(),
          audit: [...(it.result.audit || []), { action: 'unapprove', at: new Date().toISOString(), note: reason.trim() }],
        },
      };
    }));
  };

  const handleConfirmAll = async () => {
    const toConfirm = items.filter(it =>
      it.result &&
      !it.error &&
      !it.confirmed &&
      (it.result.needsReviewQuestions?.length || 0) === 0 &&
      it.result.decisionStatus === 'AUTO_ACCEPTED'
    );
    const skipped = items.filter(it =>
      it.result &&
      !it.error &&
      !it.confirmed &&
      (it.result.needsReviewQuestions?.length || 0) > 0 || it.result.decisionStatus !== 'AUTO_ACCEPTED'
    );
    for (const it of toConfirm) {
      const approved = {
        ...it.result,
        approvedAt: new Date().toISOString(),
        audit: [...(it.result.audit || []), { action: 'approve', at: new Date().toISOString(), note: 'bulk safe approve' }],
      };
      await saveOmrResult(approved);
    }
    setItems(prev => prev.map(it => (
      toConfirm.some(c => c.id === it.id) ? { ...it, confirmed: true } : it
    )));
    if (skipped.length > 0) {
      alert(`تم اعتماد ${toConfirm.length} ورقة آمنة، وتخطي ${skipped.length} ورقة تحتاج مراجعة.`);
    }
  };

  const handleConfirmReviewed = async () => {
    const toConfirmReviewed = items.filter(it =>
      it.result &&
      !it.error &&
      !it.confirmed &&
      (it.result.needsReviewQuestions?.length || 0) > 0 &&
      it.result.decisionStatus !== 'REJECTED_QUALITY'
    );
    if (toConfirmReviewed.length === 0) return;

    const ok = window.confirm(`سيتم اعتماد ${toConfirmReviewed.length} ورقة تحتاج مراجعة. تأكد أنك راجعتها يدويًا قبل المتابعة.`);
    if (!ok) return;

    for (const it of toConfirmReviewed) {
      const approved = {
        ...it.result,
        approvedAt: new Date().toISOString(),
        audit: [...(it.result.audit || []), { action: 'approve', at: new Date().toISOString(), note: 'bulk reviewed approve' }],
      };
      await saveOmrResult(approved);
    }

    setItems(prev => prev.map(it => (
      toConfirmReviewed.some(c => c.id === it.id) ? { ...it, confirmed: true } : it
    )));
  };

  const handleRemove = (itemId) => setItems(prev => prev.filter(it => it.id !== itemId));
  const handleRemoveWithCleanup = (itemId) => {
    setItems(prev => {
      const target = prev.find(it => it.id === itemId);
      if (target?.previewUrl) revokePreviewUrl(target.previewUrl);
      return prev.filter(it => it.id !== itemId);
    });
  };
  const handleClear = () => {
    setItems(prev => {
      prev.forEach(it => revokePreviewUrl(it.previewUrl));
      return [];
    });
  };

  const handleSendWhatsapp = async (item) => {
    try {
      const res = await fetch(`${WHATSAPP_API_BASE}/send-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: item.result.phone, result: item.result })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الإرسال');
      alert(`تم الإرسال لـ ${item.result.studentName} بنجاح ✅`);
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const handleAnswerEdit = (itemId, qNum, newAnswer) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId || !it.result) return it;
      if (it.confirmed || it.result.decisionStatus === 'REJECTED_QUALITY') return it;
      const details = { ...it.result.details };
      const correct = selectedExam?.keys?.[qNum] || '';
      details[qNum] = { student_answer: newAnswer, correct_option: correct, is_correct: newAnswer === correct };
      let score = 0;
      Object.values(details).forEach(d => { if (d.is_correct) score++; });
      const total = Object.keys(details).length;
      const percentage = total > 0 ? ((score / total) * 100).toFixed(2) : '0';
      return {
        ...it,
        result: {
          ...it.result,
          score, total, percentage, details,
          audit: [...(it.result.audit || []), { action: 'edit_answer', at: new Date().toISOString(), note: `Q${qNum}=${newAnswer || '-'}` }],
        },
      };
    }));
  };

  const pendingCount   = items.filter(it => it.result && !it.error && !it.confirmed).length;
  const reviewPendingCount = items.filter(it => it.result && !it.error && !it.confirmed && (it.result.needsReviewQuestions?.length || 0) > 0).length;
  const safePendingCount = items.filter(it => it.result && !it.error && !it.confirmed && (it.result.needsReviewQuestions?.length || 0) === 0 && it.result.decisionStatus === 'AUTO_ACCEPTED').length;
  const confirmedCount = items.filter(it => it.confirmed).length;
  const errorCount     = items.filter(it => it.error).length;
  const isAnyLoading   = items.some(it => it.loading) || isScannerScanning;
  const formatMs = (ms) => {
    const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const sortedItems = useMemo(() => {
    // Group "needs review" sheets together at the top for faster manual workflow.
    return [...items].sort((a, b) => {
      const aReview = (!a.confirmed && !a.error && (a.result?.needsReviewQuestions?.length || 0) > 0) ? 1 : 0;
      const bReview = (!b.confirmed && !b.error && (b.result?.needsReviewQuestions?.length || 0) > 0) ? 1 : 0;
      if (aReview !== bReview) return bReview - aReview;

      const aPending = (!a.confirmed && !a.error && a.result) ? 1 : 0;
      const bPending = (!b.confirmed && !b.error && b.result) ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;

      return (a.id || 0) - (b.id || 0);
    });
  }, [items]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-24">

      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">تصحيح OMR الآلي</h1>
          <p className="text-gray-500 mt-1 font-medium">ارفع أوراق الإجابات أو امسحها مباشرةً بالسكانر للتصحيح الفوري</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scanner status pill */}
          <div
            onClick={checkScanner}
            title="اضغط للتحديث"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border select-none
              ${scannerAvailable === null ? 'bg-gray-50 border-gray-200 text-gray-400 animate-pulse' :
                scannerAvailable ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' :
                'bg-red-50 border-red-100 text-red-500 hover:bg-red-100'}`}>
            {scannerAvailable === null ? <Loader2 size={11} className="animate-spin" /> :
             scannerAvailable ? <Wifi size={11} /> : <WifiOff size={11} />}
            {scannerAvailable === null ? 'جاري الفحص' :
             scannerAvailable ? 'سكانر متصل' : 'لا يوجد سكانر'}
          </div>
          {items.length > 0 && (
            <button type="button" onClick={handleClear} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all border border-gray-200">
              <Trash2 size={15} /> مسح الكل
            </button>
          )}
        </div>
      </div>

      {/* ── Exam Selector ── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <ListFilter size={16} className="text-indigo-500" /> تحديد الاختبار
        </label>
        <div className="grid grid-cols-3 gap-3">
          <select value={filterStage}
            onChange={e => { setFilterStage(e.target.value); setFilterGrade('All'); }}
            className="p-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
            <option value="All">كل المراحل</option>
            {Object.keys(STAGES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterGrade}
            onChange={e => { setFilterGrade(e.target.value); }}
            disabled={filterStage === 'All'}
            className="p-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400 disabled:opacity-40">
            <option value="All">كل الصفوف</option>
            {filterGrades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
            className="p-3 bg-slate-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-400">
            {visibleExams.length === 0
              ? <option disabled value="">لا يوجد اختبارات</option>
              : visibleExams.map(ex => <option key={ex.id} value={ex.id}>{ex.subject || ex.title} ({ex.qCount} س)</option>)
            }
          </select>
        </div>
        {selectedExam && (
          <div className="flex gap-2 flex-wrap">
            {selectedExam.stage && <span className="px-2 py-0.5 bg-violet-50 text-violet-600 text-xs font-bold rounded-lg">{selectedExam.stage}</span>}
            {selectedExam.grade && <span className="px-2 py-0.5 bg-blue-50  text-blue-600  text-xs font-bold rounded-lg">{selectedExam.grade}</span>}
            {selectedExam.subject && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg">{selectedExam.subject}</span>}
            <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-lg">{selectedExam.qCount} سؤال</span>
          </div>
        )}
      </div>

      {/* ── Upload + Scanner zone ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center hover:bg-indigo-50/40 hover:border-indigo-400 transition-all cursor-pointer group">
          <input ref={inputRef} type="file" className="hidden" accept="image/*" multiple
            onChange={e => e.target.files && handleFiles(e.target.files)} />
          <div className="w-14 h-14 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Upload size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">رفع الصور</h3>
          <p className="text-xs text-gray-400">اسحب الصور هنا أو اضغط للاختيار<br />PNG · JPG · رفع متعدد</p>
        </div>

        {/* Scanner zone */}
        <div
          onClick={() => {
            if (!selectedExamId) { alert('اختر الاختبار أولاً'); return; }
            setShowScannerModal(true);
          }}
          className={`border-2 rounded-2xl p-8 text-center transition-all group
            ${scannerAvailable
              ? 'border-dashed border-teal-300 hover:bg-teal-50/40 hover:border-teal-500 cursor-pointer'
              : 'border-dashed border-gray-200 opacity-60 cursor-not-allowed'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 transition-transform
            ${scannerAvailable ? 'bg-teal-100 text-teal-600 group-hover:scale-110' : 'bg-gray-100 text-gray-400'}`}>
            {isScannerScanning
              ? <Loader2 size={26} className="animate-spin" />
              : <ScanLine size={26} />}
          </div>
          <h3 className="text-base font-bold text-gray-700 mb-1">
            {isScannerScanning ? 'جاري المسح...' : 'مسح بالسكانر'}
          </h3>
          <p className="text-xs text-gray-400">
            {scannerAvailable
              ? `${scannerNames[0] || 'سكانر متصل'} · اضغط لبدء المسح المباشر`
              : 'لا يوجد سكانر متصل — تحقق من التوصيل'}
          </p>
          {scannerAvailable && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-700">
              <Wifi size={11} /> متصل
            </div>
          )}
        </div>
      </div>

      {/* ── Scan Mode Selector ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-gray-600">وضع المعالجة:</span>
        <button
          type="button"
          onClick={() => setScanMode('fast')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${scanMode === 'fast' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-sky-300'}`}
        >
          سريع
        </button>
        <button
          type="button"
          onClick={() => setScanMode('strict')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${scanMode === 'strict' ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'}`}
        >
          نهائي (دقيق)
        </button>
        <button
          type="button"
          onClick={() => setScanMode('hybrid')}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${scanMode === 'hybrid' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'}`}
        >
          هجين (مُوصى به)
        </button>
        <span className="text-xs text-gray-400">
          {scanMode === 'fast' ? 'أسرع، مناسب للفرز الأولي' : scanMode === 'strict' ? 'الأدق، مناسب للاعتماد النهائي' : 'سريع للواضح وصارم للملتبس'}
        </span>
      </div>

      {/* ── Stats Bar ── */}
      {items.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="font-bold text-gray-500">إجمالي: <span className="text-gray-800">{items.length}</span></span>
            {confirmedCount > 0 && <span className="font-bold text-green-600">✓ معتمد: {confirmedCount}</span>}
            {pendingCount > 0 && <span className="font-bold text-amber-600">⏳ بانتظار الاعتماد: {pendingCount}</span>}
            {reviewPendingCount > 0 && <span className="font-bold text-orange-600">⚠️ تحتاج مراجعة: {reviewPendingCount}</span>}
            {errorCount > 0 && <span className="font-bold text-red-500">✗ أخطاء: {errorCount}</span>}
            {isAnyLoading && <span className="font-bold text-indigo-500 flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> جاري المعالجة...</span>}
            {batchTimer.running && (
              <span className="font-bold text-sky-700">⏱️ زمن الدفعة الحالية: {formatMs(batchTimer.elapsedMs)}</span>
            )}
            {!batchTimer.running && batchTimer.lastBatchMs != null && (
              <span className="font-bold text-slate-600">
                ⏱️ آخر دفعة: {formatMs(batchTimer.lastBatchMs)} ({batchTimer.lastBatchCount} صورة)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {confirmedCount > 0 && (
              <button type="button" onClick={() => printResultSlip(items.filter(it => it.confirmed && it.result), selectedExam)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-200">
                <Printer size={16} /> طباعة المعتمدين ({confirmedCount})
              </button>
            )}
            {safePendingCount > 1 && (
              <button type="button" onClick={handleConfirmAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-green-200">
                <BadgeCheck size={17} /> اعتماد الآمن ({safePendingCount})
              </button>
            )}
            {reviewPendingCount > 0 && (
              <button
                type="button"
                onClick={handleConfirmReviewed}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-amber-200"
              >
                <BadgeCheck size={17} /> اعتماد ما يحتاج مراجعة ({reviewPendingCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Sheet Cards ── */}
      <div className="space-y-3">
        {sortedItems.map(item => (
          <SheetCard
            key={item.id}
            item={item}
            exam={selectedExam}
            onConfirm={handleConfirm}
            onUnconfirm={handleUnconfirm}
            onRemove={handleRemoveWithCleanup}
            onAnswerEdit={handleAnswerEdit}
            onSendWhatsapp={handleSendWhatsapp}
            onPrint={(it) => printResultSlip([it], selectedExam)}
          />
        ))}
      </div>

      {/* ── Scanner Modal ── */}
      <ScannerModal
        show={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScan={handleHardwareScan}
        scannerAvailable={scannerAvailable}
        scannerNames={scannerNames}
        onRefresh={checkScanner}
      />
    </div>
  );
};

export default OMRScanner;

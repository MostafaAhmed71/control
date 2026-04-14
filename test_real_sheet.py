"""
اختبار مباشر للنظام على ورقة هزاع بدر خضير الشمري
الإجابات الحقيقية المقروءة يدوياً من الصورة
"""
import sys
import os
import json

# Add omr_engine to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'omr_engine'))
import scanner

# الإجابات الحقيقية المقروءة يدوياً من الصورة
TRUTH = {
    "1": "B",   # ب
    "2": "B",   # ب
    "3": "D",   # د
    "4": "B",   # ب
    "5": "D",   # د
    "6": "A",   # أ
    "7": "A",   # أ
    "8": "B",   # ب
    "9": "D",   # د
    "10": "C",  # ج
    "11": "A",  # أ
    "12": "A",  # أ
    "13": "B",  # ب
    "14": "B",  # ب
    "15": "D",  # د
    "16": "B",  # ب
    "17": "B",  # ب
    "18": "C",  # ج
    "19": "C",  # ج
    "20": "D",  # د
    "21": "B",  # ب
    "22": "A",  # أ
    "23": "C",  # ج
    "24": "C",  # ج
    "25": "D",  # د
    "26": "A",  # أ
    "27": "A",  # أ
    "28": "B",  # ب
    "29": "C",  # ج
    "30": "B",  # ب
}

# اقرأ مسار الصورة من command line
if len(sys.argv) < 2:
    print("USAGE: python test_real_sheet.py <image_path>")
    sys.exit(1)

img_path = sys.argv[1]
print(f"\n{'='*60}")
print(f"فحص ورقة: {os.path.basename(img_path)}")
print(f"{'='*60}")

# تشغيل النظام - وضع strict
for mode in ["hybrid", "strict"]:
    result = scanner.scan_omr_with_mode(
        img_path,
        is_bytes=False,
        style="nafs",       # قالب نافس
        from_scanner=False, # صورة مرفوعة
        num_questions=30,
        scan_mode=mode,
    )
    
    pred = result.get("answers", {})
    conf = result.get("confidence", {})
    review_qs = result.get("needs_review_questions", [])
    
    print(f"\n--- وضع: {mode.upper()} ---")
    print(f"الطالب: {result.get('student_id', 'غير محدد')}")
    print(f"جودة الصورة: {result.get('quality_score', 0):.3f}")
    print(f"الحالة: {result.get('decision_status', 'غير محدد')}")
    print(f"متوسط الثقة: {result.get('average_confidence', 0):.3f}")
    print(f"أسئلة للمراجعة: {review_qs}")
    
    # مقارنة التفصيلية
    correct = 0
    wrong = 0
    blank_when_should_be_filled = 0
    filled_when_should_be_blank = 0
    total = 0
    
    print(f"\n{'س':>4} {'حقيقي':>8} {'النظام':>8} {'ثقة':>8} {'نتيجة':>10}")
    print("-" * 50)
    
    for q in sorted(TRUTH.keys(), key=int):
        truth_ans = TRUTH[q]
        pred_ans = pred.get(q, "")
        q_conf = float(conf.get(q, 0))
        
        if truth_ans == "":
            total += 1
            if pred_ans == "":
                result_sym = "✓ فارغة صح"
                correct += 1
            else:
                result_sym = "✗ أضاف إجابة"
                filled_when_should_be_blank += 1
                wrong += 1
        else:
            total += 1
            if pred_ans == truth_ans:
                result_sym = "✓"
                correct += 1
            elif pred_ans == "":
                result_sym = "✗ فاته"
                blank_when_should_be_filled += 1
                wrong += 1
            else:
                result_sym = f"✗ قرأ {pred_ans}"
                wrong += 1
        
        in_review = q in [str(x) for x in review_qs]
        review_mark = " [مراجعة]" if in_review else ""
        print(f"{q:>4} {truth_ans or '-':>8} {pred_ans or '-':>8} {q_conf:>8.3f} {result_sym}{review_mark}")
    
    print("-" * 50)
    accuracy = correct/total*100 if total else 0
    print(f"\nالنتيجة: {correct}/{total} ({accuracy:.1f}%)")
    print(f"أخطاء إدخال (أضاف وهم): {filled_when_should_be_blank}")
    print(f"أخطاء حذف (فاته ملء): {blank_when_should_be_filled}")
    print(f"أخطاء تبديل (A بدل B): {wrong - filled_when_should_be_blank - blank_when_should_be_filled}")

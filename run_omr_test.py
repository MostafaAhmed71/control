import sys, os
sys.path.insert(0, r'G:\New folder\control\control\omr_engine')
os.chdir(r'G:\New folder\control\control\omr_engine')
import scanner

img = r'G:\New folder\control\control\omr_engine\dataset\هزاع.jpeg'

TRUTH = {
    '1':'B','2':'B','3':'D','4':'B','5':'D',
    '6':'A','7':'A','8':'B','9':'D','10':'C',
    '11':'A','12':'A','13':'B','14':'B','15':'D',
    '16':'B','17':'B','18':'C','19':'C','20':'D',
    '21':'B','22':'A','23':'C','24':'C','25':'D',
    '26':'A','27':'A','28':'B','29':'C','30':'B'
}

print('Testing OMR on: هزاع.jpeg')
print('='*60)

for mode in ['hybrid','strict']:
    result = scanner.scan_omr_with_mode(
        img, is_bytes=False, style='nafs',
        from_scanner=True, num_questions=30, scan_mode=mode
    )
    pred = result.get('answers', {})
    conf = result.get('confidence', {})
    review_qs = set(str(x) for x in result.get('needs_review_questions', []))

    correct=0; wrong_list=[]; blank_miss=0; wrong_bubble=0
    for q,t in TRUTH.items():
        p = pred.get(q,'')
        if p==t:
            correct+=1
        else:
            wrong_list.append((q,t,p,float(conf.get(q,0))))
            if p=='':
                blank_miss+=1
            else:
                wrong_bubble+=1

    acc = correct/30*100
    print(f'\n[{mode.upper()}] دقة: {correct}/30 = {acc:.1f}%')
    print(f'جودة الصورة: {result.get("quality_score",0):.3f} | ثقة: {result.get("average_confidence",0):.3f}')
    print(f'حالة: {result.get("decision_status")}')
    review_sorted = sorted(review_qs, key=lambda x:int(x)) if review_qs else []
    print(f'للمراجعة: {review_sorted if review_sorted else "لا شيء"}')
    print(f'اخطاء حذف (قرأه فارغ): {blank_miss}')
    print(f'اخطاء تبديل (قرأ خطأ): {wrong_bubble}')
    if wrong_list:
        print('تفاصيل الاخطاء:')
        for q,t,p,c in sorted(wrong_list, key=lambda x:int(x[0])):
            rv = '[مراجعة]' if q in review_qs else ''
            print(f'  س{q}: صح={t} قرأ={p or "فارغ"} ثقة={c:.2f} {rv}')

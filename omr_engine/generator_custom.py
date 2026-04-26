# -*- coding: utf-8 -*-
"""
generator_custom.py — Custom OMR Template Generator
====================================================
A copy of the NAFS template layout where every text label is configurable.
Pass a `template_config` dict to override any header text.
"""
from PIL import Image, ImageDraw, ImageFont
import qrcode
import os
import base64
import io
from fpdf import FPDF
import arabic_reshaper
from bidi.algorithm import get_display
from omr_constants import *
from font_utils import truetype, has_raqm

def ar(text):
    if not text: return ""
    if has_raqm():
        return str(text)
    return get_display(arabic_reshaper.reshape(str(text)), base_dir="R")

def fmt_date_parts(date_str):
    if not date_str: return ("", "", "")
    try:
        t = str(date_str).translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
        import re
        nums = re.findall(r'\d+', t)
        if len(nums) == 3:
            y, m, d = nums[0], nums[1], nums[2]
            if len(y) != 4: y, m, d = d, m, y
            to_ar = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
            return (str(int(d)).translate(to_ar),
                    str(int(m)).translate(to_ar),
                    str(y).translate(to_ar))
    except: pass
    return (str(date_str), "", "")

try:
    FONT_XS    = truetype(25)
    FONT_SM    = truetype(35)
    FONT_MD_S  = truetype(48)
    FONT_MD    = truetype(55)
    FONT_MD_B  = truetype(60, bold=True)
    FONT_LG    = truetype(65)
    FONT_LABEL = truetype(42)
except:
    FONT_XS = FONT_SM = FONT_MD_S = FONT_MD = FONT_MD_B = FONT_LG = FONT_LABEL = None

OPT_LABELS = ["أ", "ب", "ج", "د"]

# PDF sizing: constants are in pixels at ~300 DPI. FPDF "pt" units are 1/72 inch.
# Convert px → pt so the resulting PDF page is true A4 (≈595x842 pt).
_DPI = 300
PDF_W_PT = int(round(WIDTH * 72 / _DPI))
PDF_H_PT = int(round(HEIGHT * 72 / _DPI))

# Default config — mirrors the NAFS template, override any field
DEFAULT_CONFIG = {
    "school_name":   "متوسطة وثانوية نخبة الشمال الأهلية",
    "exam_name":     "الاختبار المحاكي لاختبار نافس 2026 (اختبار مجمع)",
    "year":          "العام الدراسي ١٤٤٧ هــ",
    "principal":     "مدير المدرسة : محمد نصر الدين",
    "footer":        "نظام التصحيح الآلي بمتوسطة وثانوية نخبة الشمال الأهلية",
    "show_date_row": True,
    "show_day_row":  True,
    "show_class_row": False,
    "show_subject_row": False,
}


def draw_corner_markers(draw):
    ms = CORNER_MARKER_SIZE
    draw.rectangle([MARGIN, MARGIN, MARGIN + ms, MARGIN + ms], fill=BLACK)
    draw.rectangle([WIDTH - MARGIN - ms, MARGIN, WIDTH - MARGIN, MARGIN + ms], fill=BLACK)
    draw.rectangle([MARGIN, HEIGHT - MARGIN - ms, MARGIN + ms, HEIGHT - MARGIN], fill=BLACK)
    draw.rectangle([WIDTH - MARGIN - ms, HEIGHT - MARGIN - ms, WIDTH - MARGIN, HEIGHT - MARGIN], fill=BLACK)


def draw_header(img, draw, student_info, cfg):
    HDR_TOP   = MARGIN
    HDR_H     = 290
    HDR_LEFT  = MARGIN
    HDR_RIGHT = WIDTH - MARGIN
    LOGO_GAP  = 150  # gap from header edge — moved further inward

    draw.rectangle([HDR_LEFT, HDR_TOP, HDR_RIGHT, HDR_TOP + HDR_H], outline=BLACK, width=3)

    lines = [
        (ar(cfg["school_name"]), FONT_MD_B),
        (ar(cfg["exam_name"]),   FONT_MD_S),
        (ar(cfg["year"]),        FONT_MD_S),
    ]
    cx = WIDTH // 2
    txt_start_y = HDR_TOP + 35
    max_tw = 0
    for idx, (t, font) in enumerate(lines):
        tw = draw.textlength(t, font=font)
        draw.text((int(cx - tw // 2), txt_start_y + idx * 75), t, fill=BLACK, font=font)
        max_tw = max(max_tw, tw)

    # Logos (Slightly Smaller)
    logo_h = HDR_H - 70
    logo_base64 = cfg.get("logoDataUrl", "")
    custom_logo = None
    
    if logo_base64 and "," in logo_base64:
        try:
            header, encoded = logo_base64.split(",", 1)
            img_data = base64.b64decode(encoded)
            custom_logo = Image.open(io.BytesIO(img_data)).convert("RGBA")
        except: pass

    for side in ['right', 'left']:
        try:
            logo = None
            if custom_logo:
                logo = custom_logo.copy()
            else:
                # Default logo fallback
                fname = "شعار المدرسة.jpeg" if side == 'right' else "شعار الوزارة.png"
                path  = os.path.join(os.path.dirname(__file__), "..", "public", fname)
                if os.path.exists(path):
                    logo = Image.open(path).convert("RGBA")
            
            if logo:
                logo = logo.resize((int(logo.width * logo_h / logo.height), logo_h))
                if side == 'right':
                    lx = HDR_RIGHT - LOGO_GAP - logo.width
                else:
                    lx = HDR_LEFT + LOGO_GAP
                ly = HDR_TOP + (HDR_H - logo.height) // 2
                img.paste(logo, (lx, ly), logo)
        except: pass

    # Student info rows (NAFS layout: Name, Date, Day)
    start_y = HEADER_START_Y
    row_h   = HEADER_ROW_H
    w       = HEADER_WIDTH
    x       = MARGIN
    P       = 40

    def rt(label, box_right, y_top, font=FONT_LABEL):
        t  = ar(label)
        tw = draw.textlength(t, font=font)
        ty = y_top + (row_h - 60) // 2
        draw.text((box_right - tw - P, ty), t, fill=BLACK, font=font)
        return box_right - tw - P * 2

    # Row 1: Name (always shown)
    draw.rectangle([x, start_y, x + w, start_y + row_h], outline=BLACK, width=3)
    ll = rt("اسم الطالب:", x + w, start_y)
    nv = ar(student_info.get("name", ""))
    draw.text((ll - draw.textlength(nv, font=FONT_LG) - P,
               start_y + (row_h - 65) // 2), nv, fill=BLACK, font=FONT_LG)

    row_offset = 1

    show_date = bool(cfg.get("show_date_row", True))
    show_day = bool(cfg.get("show_day_row", True))

    # Render date/day in one compact row when both are enabled.
    if show_date and show_day:
        y = start_y + row_offset * row_h
        draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
        mid_x = x + w // 2
        draw.line([(mid_x, y), (mid_x, y + row_h)], fill=BLACK, width=3)

        day_num, month, year_ar = fmt_date_parts(student_info.get("date", ""))
        date_val = f"{day_num} - {month} - {year_ar}" if year_ar else day_num

        def draw_cell(label, value, cell_left, cell_right):
            ll = rt(label, cell_right, y)
            vv = ar(value)
            draw.text((ll - draw.textlength(vv, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), vv, fill=BLACK, font=FONT_LG)

        draw_cell("التاريخ:", date_val, mid_x, x + w)
        draw_cell("اليوم:", student_info.get("day", ""), x, mid_x)
        row_offset += 1
    else:
        # Row: Date
        if show_date:
            y = start_y + row_offset * row_h
            draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
            lld = rt("التاريخ:", x + w, y)
            day_num, month, year_ar = fmt_date_parts(student_info.get("date", ""))
            dv = ar(f"{day_num} - {month} - {year_ar}") if year_ar else ar(day_num)
            draw.text((lld - draw.textlength(dv, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), dv, fill=BLACK, font=FONT_LG)
            row_offset += 1

        # Row: Day
        if show_day:
            y = start_y + row_offset * row_h
            draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
            lly = rt("اليوم:", x + w, y)
            dy_val = ar(student_info.get("day", ""))
            draw.text((lly - draw.textlength(dy_val, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), dy_val, fill=BLACK, font=FONT_LG)
            row_offset += 1

    show_class = bool(cfg.get("show_class_row", False))
    show_subject = bool(cfg.get("show_subject_row", False))

    # Render class/subject in one compact row when both are enabled.
    if show_class and show_subject:
        y = start_y + row_offset * row_h
        draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
        mid_x = x + w // 2
        draw.line([(mid_x, y), (mid_x, y + row_h)], fill=BLACK, width=3)

        def draw_cell(label, value, cell_left, cell_right):
            ll = rt(label, cell_right, y)
            vv = ar(value)
            draw.text((ll - draw.textlength(vv, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), vv, fill=BLACK, font=FONT_LG)

        draw_cell("الصف:", student_info.get("class", ""), mid_x, x + w)
        draw_cell("المادة:", student_info.get("subject", ""), x, mid_x)
        row_offset += 1
    else:
        # Row: Class (optional)
        if show_class:
            y = start_y + row_offset * row_h
            draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
            llc = rt("الصف:", x + w, y)
            cv = ar(student_info.get("class", ""))
            draw.text((llc - draw.textlength(cv, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), cv, fill=BLACK, font=FONT_LG)
            row_offset += 1

        # Row: Subject (optional)
        if show_subject:
            y = start_y + row_offset * row_h
            draw.rectangle([x, y, x + w, y + row_h], outline=BLACK, width=3)
            lls = rt("المادة:", x + w, y)
            sv = ar(student_info.get("subject", ""))
            draw.text((lls - draw.textlength(sv, font=FONT_LG) - P,
                       y + (row_h - 65) // 2), sv, fill=BLACK, font=FONT_LG)


def build_qr_payload(student_info, num_questions=30, template="custom"):
    payload = {
        "id": str(student_info.get("id", "0")),
        "nq": int(num_questions),
        "tpl": str(template),
    }
    import json
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def draw_qr_code(img, qr_payload):
    qr = qrcode.QRCode(box_size=15, border=1)
    qr.add_data(qr_payload)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE))
    img.paste(qr_img, (QR_X, QR_Y))


def draw_questions_section(draw, start_y, num_questions=30):
    half    = (WIDTH - 2 * MARGIN) // 2
    GAP     = 60
    col_w   = half - GAP // 2
    r_col_x = MARGIN + half + GAP // 2
    l_col_x = MARGIN

    opt_labels_ar = [ar(o) for o in OPT_LABELS]
    header_y      = start_y - 100
    NUM_AREA      = 120

    for col_x in [r_col_x, l_col_x]:
        num_right = col_x + col_w - 10
        bub_right = num_right - NUM_AREA
        for oi, t in enumerate(opt_labels_ar):
            ox = bub_right - oi * QS_OPT_SPACING
            tw = int(draw.textlength(t, font=FONT_SM))
            draw.text((int(ox) - tw // 2, header_y), t, fill=BLACK, font=FONT_SM)

    per_col = (num_questions + 1) // 2
    for q in range(num_questions):
        col_x = r_col_x if q < per_col else l_col_x
        row   = q if q < per_col else q - per_col
        q_num = q + 1
        y     = start_y + row * QS_ROW_SPACING
        num_right = col_x + col_w - 10
        bub_right = num_right - NUM_AREA

        nt  = ar("%d." % q_num)
        ntw = draw.textlength(nt, font=FONT_SM)
        draw.text((int(num_right - ntw), y - 18), nt, fill=BLACK, font=FONT_SM)

        for oi in range(4):
            ox = bub_right - oi * QS_OPT_SPACING
            r  = QS_BUBBLE_R
            draw.ellipse([int(ox - r), int(y - r), int(ox + r), int(y + r)],
                         outline=BLACK, width=4)


def generate_personalized_sheet(student_info, template_config=None, num_questions=30, filename=None):
    cfg = {**DEFAULT_CONFIG, **(template_config or {})}
    img  = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(img)
    draw_corner_markers(draw)
    draw_header(img, draw, student_info, cfg)
    qr_payload = build_qr_payload(student_info, num_questions=num_questions, template="custom")
    draw_qr_code(img, qr_payload)
    draw_questions_section(draw, QS_START_Y, num_questions=num_questions)

    # Footer
    fy_top = HEIGHT - MARGIN - 160
    fy_bot = HEIGHT - MARGIN - 40
    pt  = ar(cfg["principal"])
    draw.text((MARGIN + 40, fy_top), pt, fill=BLACK, font=FONT_MD)
    st  = ar(cfg["footer"])
    stw = draw.textlength(st, font=FONT_MD)
    draw.text(((WIDTH - stw) // 2, fy_bot), st, fill=BLACK, font=FONT_MD)

    if filename:
        img.save(filename)
    return img


def create_bulk_pdf(students_list, template_config=None, output_pdf="omr_custom_batch.pdf"):
    """PDF generation using temp files (fpdf 1.x compatibility)."""
    import tempfile
    cfg = {**DEFAULT_CONFIG, **(template_config or {})}
    pdf = FPDF(unit="pt", format=(PDF_W_PT, PDF_H_PT))
    tmp_files = []
    try:
        for idx, student in enumerate(students_list):
            num_q = student.get("num_questions", 30)
            img   = generate_personalized_sheet(student, cfg, num_questions=num_q)
            tmp   = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            tmp.close()
            img.save(tmp.name, format="JPEG", quality=95)
            tmp_files.append(tmp.name)
            pdf.add_page()
            pdf.image(tmp.name, 0, 0, PDF_W_PT, PDF_H_PT)
        pdf.output(output_pdf)
    finally:
        for f in tmp_files:
            try:
                os.remove(f)
            except Exception:
                pass
    return output_pdf


def create_bulk_pdf_stream(students_list, template_config=None, output_pdf="omr_custom_batch.pdf"):
    """Generator: yields progress dicts then finished. Uses temp files for fpdf 1.x."""
    import tempfile
    cfg   = {**DEFAULT_CONFIG, **(template_config or {})}
    pdf   = FPDF(unit="pt", format=(PDF_W_PT, PDF_H_PT))
    total = len(students_list)
    tmp_files = []
    try:
        for idx, student in enumerate(students_list):
            num_q = student.get("num_questions", 30)
            img   = generate_personalized_sheet(student, cfg, num_questions=num_q)
            tmp   = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            tmp.close()
            img.save(tmp.name, format="JPEG", quality=95)
            tmp_files.append(tmp.name)
            pdf.add_page()
            pdf.image(tmp.name, 0, 0, PDF_W_PT, PDF_H_PT)
            yield {"done": idx + 1, "total": total, "name": student.get("name", "")}
        pdf.output(output_pdf)
    finally:
        for f in tmp_files:
            try:
                os.remove(f)
            except Exception:
                pass
    yield {"finished": True, "path": output_pdf}

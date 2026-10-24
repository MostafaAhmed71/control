# -*- coding: utf-8 -*-
"""
Official وزارة التعليم — الاختبارات الوطنية sheet.

Prints only the official form. No QR, no corner markers, no school extra fields.
Optional: fill the official national-ID and school-code bubble grids
(those fields exist on the ministry form).
"""
import os
import tempfile
from PIL import Image, ImageDraw
from fpdf import FPDF
import arabic_reshaper
from bidi.algorithm import get_display

from omr_constants import WIDTH, HEIGHT
from font_utils import truetype
from omr_watania import (
    PAGE_L, PAGE_R, PAGE_W,
    MOE_LOGO_TOP, MOE_LOGO_MAX_H,
    BANNER_Y, BANNER_H, BANNER_W,
    NAME_Y, NAME_H,
    ID_Y, ID_H, NID_X, NID_W, CODE_X, CODE_W, INFO_X, INFO_W,
    GRID_HEADER_H, GRID_WRITE_H, GRID_PAD_X,
    ID_BUBBLE_R, ANS_Y, ANS_HEADER_H, ANS_BUBBLE_R, ANS_PER_COL,
    LINE, BLACK, WHITE,
    national_id_grid, school_code_grid, answer_columns,
)

_DPI = 300
PDF_W_PT = int(round(WIDTH * 72 / _DPI))
PDF_H_PT = int(round(HEIGHT * 72 / _DPI))

# Always reshape locally — Pillow may report RAQM then fall back to basic layout.
_RAQM = False
_TXT_KW = {}

try:
    FONT_XS = truetype(22)
    FONT_SM = truetype(30)
    FONT_MD = truetype(40)
    FONT_MD_B = truetype(46, bold=True)
    FONT_LG = truetype(52, bold=True)
    FONT_BANNER = truetype(42, bold=True)
except Exception:
    FONT_XS = FONT_SM = FONT_MD = FONT_MD_B = FONT_LG = FONT_BANNER = None


def ar(text):
    if not text:
        return ""
    if _RAQM:
        return str(text)
    return get_display(arabic_reshaper.reshape(str(text)), base_dir="R")


def _tl(draw, text, font):
    return draw.textlength(text, font=font, **_TXT_KW)


def _dt(draw, xy, text, font, fill=BLACK):
    return draw.text(xy, text, fill=fill, font=font, **_TXT_KW)


def _center_text(draw, text, cx, y, font, fill=BLACK):
    t = ar(text)
    tw = _tl(draw, t, font=font)
    _dt(draw, (int(cx - tw / 2), y), t, font=font, fill=fill)


def _digits_only(value, width):
    raw = str(value or "")
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    digits = "".join(ch for ch in raw.translate(trans) if ch.isdigit())
    if not digits:
        return ""
    if len(digits) > width:
        digits = digits[-width:]
    return digits.zfill(width) if len(digits) >= width else digits


def _draw_round_rect(draw, box, radius=22, width=LINE):
    draw.rounded_rectangle(box, radius=radius, outline=BLACK, width=width)


def _draw_dotted_line(draw, x1, y, x2, step=14):
    x = x1
    while x < x2:
        draw.line([(x, y), (min(x + 7, x2), y)], fill=BLACK, width=2)
        x += step


_HERE = os.path.dirname(os.path.abspath(__file__))
MOE_LOGO_PATH = os.path.join(_HERE, "templates", "moe_logo.png")


def _load_moe_logo(max_h=MOE_LOGO_MAX_H):
    if not os.path.exists(MOE_LOGO_PATH):
        return None
    logo = Image.open(MOE_LOGO_PATH).convert("RGB")
    w, h = logo.size
    if h <= 0:
        return None
    scale = max_h / float(h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return logo.resize((nw, nh), Image.Resampling.LANCZOS)


def draw_moe_logo(img, cx, top):
    """Paste the official Ministry of Education wordmark (dots + name)."""
    logo = _load_moe_logo()
    if logo is None:
        return 0
    x = int(cx - logo.width / 2)
    y = int(top)
    img.paste(logo, (x, y))
    return logo.height


def draw_header(img, draw):
    cx = WIDTH // 2
    logo_h = draw_moe_logo(img, cx, MOE_LOGO_TOP)
    banner_y = BANNER_Y
    if logo_h:
        banner_y = max(BANNER_Y, MOE_LOGO_TOP + logo_h + 10)
    bx1 = cx - BANNER_W // 2
    _draw_round_rect(draw, [bx1, banner_y, bx1 + BANNER_W, banner_y + BANNER_H], radius=28)
    _center_text(draw, "الاختبارات الوطنية", cx, banner_y + 20, FONT_BANNER)


def draw_name_row(draw):
    _draw_round_rect(draw, [PAGE_L, NAME_Y, PAGE_R, NAME_Y + NAME_H], radius=10)
    label = ar("الاسم الرباعي:")
    tw = _tl(draw, label, FONT_MD)
    _dt(draw, (PAGE_R - 28 - tw, NAME_Y + 20), label, FONT_MD)
    _draw_dotted_line(draw, PAGE_L + 36, NAME_Y + NAME_H // 2 + 8, PAGE_R - tw - 50)


def _draw_digit_box(draw, x, y, w, h, title, n_cols, filled_digits=""):
    _draw_round_rect(draw, [x, y, x + w, y + h], radius=8)
    draw.rectangle([x, y, x + w, y + GRID_HEADER_H], outline=BLACK, width=LINE)
    _center_text(draw, title, x + w / 2, y + 10, FONT_SM)

    inner_l = x + GRID_PAD_X
    inner_r = x + w - GRID_PAD_X
    inner_w = inner_r - inner_l
    col_sp = inner_w / float(n_cols)
    write_y = y + GRID_HEADER_H
    for i in range(n_cols):
        bx1 = int(inner_l + i * col_sp)
        bx2 = int(inner_l + (i + 1) * col_sp)
        draw.rectangle([bx1, write_y + 6, bx2 - 4, write_y + GRID_WRITE_H - 4], outline=BLACK, width=2)
        if filled_digits and i < len(filled_digits):
            _center_text(draw, filled_digits[i], (bx1 + bx2 - 4) / 2, write_y + 10, FONT_SM)

    xs, ys, _, _ = (
        national_id_grid() if n_cols == 10 else school_code_grid()
    )
    # xs from helper already match this box
    filled_set = {}
    if filled_digits:
        for i, ch in enumerate(filled_digits):
            if ch.isdigit() and i < n_cols:
                filled_set[i] = int(ch)

    for col_i, cx in enumerate(xs):
        for digit, cy in enumerate(ys):
            r = ID_BUBBLE_R
            box = [cx - r, cy - r, cx + r, cy + r]
            if filled_set.get(col_i) == digit:
                draw.ellipse(box, fill=BLACK, outline=BLACK, width=2)
            else:
                draw.ellipse(box, outline=BLACK, width=3)
                mark = ar(str(digit))
                mw = _tl(draw, mark, FONT_XS)
                _dt(draw, (int(cx - mw / 2), int(cy - 11)), mark, FONT_XS)


def draw_id_section(draw, national_id="", school_code=""):
    nid_digits = _digits_only(national_id, 10)
    code_digits = _digits_only(school_code, 6)

    _draw_digit_box(draw, NID_X, ID_Y, NID_W, ID_H, "رقم السجل المدني / رقم الإقامة", 10, nid_digits)
    _draw_digit_box(draw, CODE_X, ID_Y, CODE_W, ID_H, "رمز المدرسة", 6, code_digits)

    _draw_round_rect(draw, [INFO_X, ID_Y, INFO_X + INFO_W, ID_Y + ID_H], radius=8)
    fields = ["اسم المدرسة:", "الصف:", "الفصل:"]
    block_h = (ID_H - 40) / 3.0
    for i, title in enumerate(fields):
        fy = ID_Y + 24 + i * block_h
        label = ar(title)
        tw = _tl(draw, label, FONT_MD)
        _dt(draw, (INFO_X + INFO_W - 28 - tw, int(fy)), label, FONT_MD)
        _draw_dotted_line(draw, INFO_X + 28, int(fy + 48), INFO_X + INFO_W - tw - 44)


def draw_answers(draw):
    _draw_round_rect(draw, [PAGE_L, ANS_Y, PAGE_R, HEIGHT - 70], radius=8)
    draw.rectangle([PAGE_L, ANS_Y, PAGE_R, ANS_Y + ANS_HEADER_H], outline=BLACK, width=LINE)
    _center_text(draw, "إجابات الأسئلة", WIDTH // 2, ANS_Y + 12, FONT_MD_B)

    cols, y0, row_sp = answer_columns()
    opt_ar = [ar("أ"), ar("ب"), ar("ج"), ar("د")]
    for col in cols:
        header_y = ANS_Y + ANS_HEADER_H + 18
        for oi, lab in enumerate(opt_ar):
            ox = col["xs"][oi]
            tw = _tl(draw, lab, FONT_SM)
            _dt(draw, (int(ox - tw / 2), header_y), lab, FONT_SM)

    for q in range(30):
        xs, y = None, None
        col_i = q // ANS_PER_COL
        row_i = q % ANS_PER_COL
        col = cols[col_i]
        xs = col["xs"]
        y = int(y0 + row_i * row_sp)
        qn = ar(str(q + 1))
        ntw = _tl(draw, qn, FONT_SM)
        _dt(draw, (int(col["num_right"] - ntw), y - 14), qn, FONT_SM)
        for ox in xs:
            r = ANS_BUBBLE_R
            draw.ellipse([ox - r, y - r, ox + r, y + r], outline=BLACK, width=3)


def generate_personalized_sheet(student_info=None, filename=None):
    """Official ministry replica — never prints student or school data."""
    img = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(img)
    draw_header(img, draw)
    draw_name_row(draw)
    draw_id_section(draw, national_id="", school_code="")
    draw_answers(draw)
    if filename:
        img.save(filename)
    return img


def generate_blank_sheet(filename=None):
    return generate_personalized_sheet({"id": "", "school_code": ""}, filename=filename)


def _students_to_pdf(students_list, output_pdf):
    pdf = FPDF(unit="pt", format=(PDF_W_PT, PDF_H_PT))
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp.close()
    try:
        generate_blank_sheet(filename=tmp.name)
        pages = max(1, len(students_list) or 1)
        for _ in range(pages):
            pdf.add_page()
            pdf.image(tmp.name, 0, 0, PDF_W_PT, PDF_H_PT)
        pdf.output(output_pdf)
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass
    return output_pdf


def create_bulk_pdf(students_list, output_pdf="omr_watania_batch.pdf"):
    return _students_to_pdf(students_list, output_pdf)


def create_bulk_pdf_stream(students_list, output_pdf="omr_watania_batch.pdf"):
    pdf = FPDF(unit="pt", format=(PDF_W_PT, PDF_H_PT))
    total = max(1, len(students_list) or 1)
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    tmp.close()
    try:
        generate_blank_sheet(filename=tmp.name)
        for idx in range(total):
            pdf.add_page()
            pdf.image(tmp.name, 0, 0, PDF_W_PT, PDF_H_PT)
            name = ""
            if students_list and idx < len(students_list):
                name = students_list[idx].get("name", "")
            yield {"done": idx + 1, "total": total, "name": name}
        pdf.output(output_pdf)
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass
    yield {"finished": True, "path": output_pdf}


if __name__ == "__main__":
    generate_personalized_sheet(
        {"id": "1071234567", "school_code": "123456", "name": ""},
        filename="watania_preview.jpg",
    )
    print("Saved watania_preview.jpg")

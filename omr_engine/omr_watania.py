# -*- coding: utf-8 -*-
"""
Official Ministry of Education — الاختبارات الوطنية
Geometry shared by generator and scanner.

No QR, no corner markers, no extra school branding.
Student identity = رقم السجل المدني bubble grid only.
"""
from omr_constants import WIDTH, HEIGHT

PAGE_L = 168
PAGE_R = WIDTH - 168
PAGE_W = PAGE_R - PAGE_L
COL_GAP = 30

# Header — official MOE wordmark then national-exams banner
MOE_LOGO_TOP = 28
MOE_LOGO_MAX_H = 292
BANNER_Y = 332
BANNER_H = 86
BANNER_W = 760

# الاسم الرباعي
NAME_Y = 438
NAME_H = 80

# ثلاث خانات: رقم السجل | رمز المدرسة | بيانات المدرسة
ID_Y = 546
ID_H = 1090
INFO_W = 690
CODE_W = 560
NID_W = PAGE_W - INFO_W - CODE_W - 2 * COL_GAP
NID_X = PAGE_L
CODE_X = NID_X + NID_W + COL_GAP
INFO_X = CODE_X + CODE_W + COL_GAP

# شبكات الأرقام
NID_COLS = 10
CODE_COLS = 6
DIGIT_ROWS = 10
GRID_HEADER_H = 52
GRID_WRITE_H = 48
GRID_PAD_X = 22
GRID_PAD_TOP = 10
ID_BUBBLE_R = 22

# إجابات الأسئلة — 3 أعمدة × 10
ANS_Y = 1690
ANS_HEADER_H = 56
ANS_BODY_Y = ANS_Y + ANS_HEADER_H
ANS_H = HEIGHT - ANS_BODY_Y - 90
ANS_PER_COL = 10
ANS_COLS = 3
ANS_BUBBLE_R = 20
ANS_OPT_GAP = 78
ANS_NUM_W = 88

LINE = 3
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


def _digit_grid_origin(box_x, box_w, n_cols):
    inner_l = box_x + GRID_PAD_X
    inner_r = box_x + box_w - GRID_PAD_X
    inner_w = inner_r - inner_l
    col_sp = inner_w / float(n_cols)
    xs = [int(inner_l + (i + 0.5) * col_sp) for i in range(n_cols)]
    body_top = ID_Y + GRID_HEADER_H + GRID_WRITE_H + GRID_PAD_TOP
    body_bot = ID_Y + ID_H - 28
    row_sp = (body_bot - body_top) / float(DIGIT_ROWS)
    ys = [int(body_top + (r + 0.5) * row_sp) for r in range(DIGIT_ROWS)]
    return xs, ys, row_sp, col_sp


def national_id_grid():
    """Leftmost column = first digit of the 10-digit ID (LTR)."""
    return _digit_grid_origin(NID_X, NID_W, NID_COLS)


def school_code_grid():
    return _digit_grid_origin(CODE_X, CODE_W, CODE_COLS)


def answer_columns():
    """
    RTL: col 0 = Q1-10 (right), col 1 = Q11-20, col 2 = Q21-30 (left).
    Within a column, xs[0]=أ (rightmost) … xs[3]=د.
    """
    inner_w = PAGE_W - 2 * COL_GAP
    col_w = inner_w / 3.0
    left_x = PAGE_L
    mid_x = PAGE_L + col_w + COL_GAP
    right_x = PAGE_L + 2 * (col_w + COL_GAP)
    # visual RTL order on page: right, mid, left
    col_origins = [right_x, mid_x, left_x]
    cols = []
    for ox in col_origins:
        num_right = ox + col_w - 14
        bub_right = num_right - ANS_NUM_W
        xs = [int(bub_right - j * ANS_OPT_GAP) for j in range(4)]
        cols.append({"x": ox, "w": col_w, "xs": xs, "num_right": num_right})
    row_sp = (ANS_H - 36) / float(ANS_PER_COL)
    y0 = ANS_BODY_Y + 110
    return cols, y0, row_sp


def question_center(q_index, cols=None, y0=None, row_sp=None):
    """q_index is 0-based. Returns (xs, y)."""
    if cols is None:
        cols, y0, row_sp = answer_columns()
    col_i = min(q_index // ANS_PER_COL, ANS_COLS - 1)
    row_i = q_index % ANS_PER_COL
    y = int(y0 + row_i * row_sp)
    return cols[col_i]["xs"], y

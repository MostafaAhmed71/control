# -*- coding: utf-8 -*-
"""
Professional OMR Scanner — High-Accuracy Edition
=================================================
Target: 99% accuracy via:
  1. Corner-marker alignment   → precise coordinate calibration
  2. CLAHE preprocessing       → handle scanner brightness variations
  3. Adaptive local threshold  → per-bubble contrast, not global
  4. Relative dominance check  → filled bubble must be 3× darker than 2nd
  5. Strict blank detection    → blank row stays blank (no false D answers)
"""

import cv2
import numpy as np
import os
import json
import hashlib
import base64
import tempfile
from datetime import datetime
from omr_constants import *

try:
    from pyzbar.pyzbar import decode as decode_qr
except Exception:
    decode_qr = None

# Write debug/audit files outside the workspace by default to avoid
# dev-server file watchers triggering page/app reload.
DEBUG_DIR = os.getenv("OMR_DEBUG_DIR", os.path.join(tempfile.gettempdir(), "omr_debug_scans"))
if not os.path.exists(DEBUG_DIR):
    os.makedirs(DEBUG_DIR)

AUDIT_LOG_PATH = os.path.join(DEBUG_DIR, "omr_audit_log.jsonl")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Image Alignment
# ══════════════════════════════════════════════════════════════════════════════

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s    = pts.sum(axis=1)
    rect[0], rect[2] = pts[np.argmin(s)], pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def get_paper_contour(img_gray):
    """Locate the A4 paper boundary (must cover >50% of image area)."""
    blurred = cv2.GaussianBlur(img_gray, (7, 7), 0)
    edged   = cv2.Canny(blurred, 30, 120)
    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    img_h, img_w = img_gray.shape
    img_area = img_w * img_h
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 0.50 * img_area:
            break
        peri   = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(approx)
            if h > w * 1.1:
                return approx
    return None


def find_corner_markers(warped_gray):
    """
    Detect the four black corner squares printed by generator.py.
    Returns (tl, tr, bl, br) pixel coords of marker centres, or None.
    
    Each marker is CORNER_MARKER_SIZE × CORNER_MARKER_SIZE = 80×80 px
    printed at the four corners at distance MARGIN (150 px) from page edge.
    Expected centres (at generated resolution):
        TL = (MARGIN + 40, MARGIN + 40)  →  (190, 190)
        TR = (WIDTH - MARGIN - 40, MARGIN + 40)
        BL = (MARGIN + 40, HEIGHT - MARGIN - 40)
        BR = (WIDTH - MARGIN - 40, HEIGHT - MARGIN - 40)
    """
    ms   = CORNER_MARKER_SIZE      # 80
    off  = MARGIN + ms // 2        # 190  — expected centre offset from edge
    h, w = warped_gray.shape

    # Expected centre positions (in the warped/resized image)
    expected = {
        "TL": (int(off * w / WIDTH),      int(off * h / HEIGHT)),
        "TR": (int((WIDTH - off) * w / WIDTH), int(off * h / HEIGHT)),
        "BL": (int(off * w / WIDTH),      int((HEIGHT - off) * h / HEIGHT)),
        "BR": (int((WIDTH - off) * w / WIDTH), int((HEIGHT - off) * h / HEIGHT)),
    }

    # Search radius around each expected position  
    search_r = int(ms * 2.5 * w / WIDTH)   # ~½ of cell @ 300dpi

    found = {}
    for name, (cx, cy) in expected.items():
        x1, y1 = max(0, cx - search_r), max(0, cy - search_r)
        x2, y2 = min(w, cx + search_r), min(h, cy + search_r)
        roi = warped_gray[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        _, binary = cv2.threshold(roi, 80, 255, cv2.THRESH_BINARY_INV)
        cnts, _   = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        best = None
        best_area = 0
        marker_expected_area = (ms * w / WIDTH) ** 2
        for c in cnts:
            area = cv2.contourArea(c)
            if area < marker_expected_area * 0.2:   # too small — noise
                continue
            if area > marker_expected_area * 3.0:   # too big  — wrong blob
                continue
            if area > best_area:
                best_area = area
                best = c
        if best is not None:
            M2 = cv2.moments(best)
            if M2["m00"] > 0:
                bx = int(M2["m10"] / M2["m00"]) + x1
                by = int(M2["m01"] / M2["m00"]) + y1
                found[name] = (bx, by)

    if len(found) == 4:
        return found["TL"], found["TR"], found["BL"], found["BR"]
    return None


def refine_warp_with_markers(warped, warped_gray):
    """
    If all four corner markers are detected, apply a second perspective
    correction so bubble coordinates match the generated template exactly.
    Returns the refined image (or original if markers are not found).
    """
    corners = find_corner_markers(warped_gray)
    if corners is None:
        return warped, warped_gray

    tl, tr, bl, br = corners
    src_pts = np.array([tl, tr, br, bl], dtype="float32")

    # The ideal positions (centres of the printed markers in pixel space)
    ms  = CORNER_MARKER_SIZE  # 80
    off = MARGIN + ms // 2    # 190
    dst_pts = np.array([
        [off, off],
        [WIDTH - off, off],
        [WIDTH - off, HEIGHT - off],
        [off, HEIGHT - off],
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    refined = cv2.warpPerspective(warped, M, (WIDTH, HEIGHT))
    refined_gray = cv2.cvtColor(refined, cv2.COLOR_BGR2GRAY)
    return refined, refined_gray


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Image Preprocessing
# ══════════════════════════════════════════════════════════════════════════════

def preprocess(gray):
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    to normalise brightness variations across the scanned sheet.
    Produces a high-contrast version ideal for bubble detection.
    """
    clahe   = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(16, 16))
    equalized = clahe.apply(gray)
    return equalized


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Single-Bubble Ink Density
# ══════════════════════════════════════════════════════════════════════════════

def bubble_ink_ratio(proc_gray, cx, cy, radius):
    """
    Measure the fraction of dark pixels inside a circular bubble region.
    Uses LOCAL adaptive thresholding so each bubble is judged by its
    own local contrast — not a global image threshold.
    
    Returns a float in [0.0, 1.0] where ~0 = empty, ~0.5+ = filled.
    Returns -1.0 if the region is out of bounds.
    """
    r = int(radius)
    x1, y1 = int(cx) - r, int(cy) - r
    x2, y2 = int(cx) + r, int(cy) + r

    h, w = proc_gray.shape
    if x1 < 0 or y1 < 0 or x2 >= w or y2 >= h:
        return -1.0

    roi = proc_gray[y1:y2, x1:x2].copy()
    roi_h, roi_w = roi.shape

    # Circular mask on the inner core only (ignore printed ring outline)
    # to reduce false positives on empty circles.
    mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
    cv2.circle(mask, (r, r), int(r * 0.58), 255, -1)

    # Local adaptive threshold — handles uneven illumination per bubble
    # blockSize must be odd; use ~half the bubble diameter
    block = max(3, (r | 1))         # nearest odd ≥ r
    if block % 2 == 0:
        block += 1
    local_thresh = cv2.adaptiveThreshold(
        roi, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block, 8
    )

    masked   = cv2.bitwise_and(local_thresh, mask)
    circle_area = cv2.countNonZero(mask)
    if circle_area == 0:
        return 0.0

    dark_px = cv2.countNonZero(masked)
    return dark_px / circle_area


def bubble_darkness(gray, cx, cy, radius):
    """
    Measure raw grayscale darkness in the bubble core (0=white, 1=black).
    This helps reject light print-through / stamp artifacts that may pass
    binary thresholding but are not real pen marks.
    """
    r = int(radius)
    x1, y1 = int(cx) - r, int(cy) - r
    x2, y2 = int(cx) + r, int(cy) + r

    h, w = gray.shape
    if x1 < 0 or y1 < 0 or x2 >= w or y2 >= h:
        return -1.0

    roi = gray[y1:y2, x1:x2]
    if roi.size == 0:
        return -1.0

    mask = np.zeros(roi.shape, dtype=np.uint8)
    cv2.circle(mask, (r, r), int(r * 0.58), 255, -1)
    mean_intensity = cv2.mean(roi, mask=mask)[0]
    darkness = (255.0 - mean_intensity) / 255.0
    return float(max(0.0, min(1.0, darkness)))


def row_densities(proc_gray, xs, cy, radius, y_tolerance=30):
    """
    For each bubble centre x in `xs`, scan ±y_tolerance pixels vertically
    (step 3 px), then use a robust percentile score instead of max.
    This avoids single-noise spikes causing false detections.
    """
    samples = [[] for _ in xs]
    for dy in range(-y_tolerance, y_tolerance + 1, 3):
        y = cy + dy
        for i, x in enumerate(xs):
            d = bubble_ink_ratio(proc_gray, x, y, radius)
            if d >= 0:
                samples[i].append(d)

    robust = []
    for vals in samples:
        if not vals:
            robust.append(0.0)
            continue
        robust.append(float(np.percentile(vals, 70)))
    return robust


def row_darknesses(gray, xs, cy, radius, y_tolerance=30):
    """Robust per-option darkness score across small vertical jitter."""
    samples = [[] for _ in xs]
    for dy in range(-y_tolerance, y_tolerance + 1, 3):
        y = cy + dy
        for i, x in enumerate(xs):
            d = bubble_darkness(gray, x, y, radius)
            if d >= 0:
                samples[i].append(d)

    robust = []
    for vals in samples:
        if not vals:
            robust.append(0.0)
            continue
        robust.append(float(np.percentile(vals, 70)))
    return robust


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Answer Selection (The Core Logic)
# ══════════════════════════════════════════════════════════════════════════════

RTL_MAP = ["A", "B", "C", "D"]   # index 0=أ (rightmost), 3=د (leftmost)

# ── Tunable Constants ─────────────────────────────────────────────────────────
# A bubble must reach at least FILL_THRESHOLD ink-ratio to be considered filled.
# Below this → the row is blank (no answer).
FILL_THRESHOLD   = 0.20   # Conservative threshold to suppress noise

# The winning bubble must have at least DOMINANCE_RATIO × the 2nd-highest.
# This rejects ambiguous double-filled or heavily-erased sheets.
DOMINANCE_RATIO  = 2.4    # winner must dominate strongly

# If winner ≥ STRONG_FILL and second < WEAK_FILL, always accept (no ratio check).
STRONG_FILL = 0.32   # definitely filled
WEAK_FILL   = 0.10   # definitely empty

# Raw grayscale darkness gate: rejects light print-through artifacts.
DARKNESS_THRESHOLD = 0.20
STRONG_DARKNESS    = 0.35

def _robust_noise_floor(values):
    """
    Estimate per-sheet background/noise level from the lower half of values.
    Returns (median, mad) where mad is median absolute deviation.
    """
    if not values:
        return 0.0, 0.0
    arr = np.array(values, dtype=np.float32)
    arr = np.sort(arr)
    lower = arr[: max(1, len(arr) // 2)]
    med = float(np.median(lower))
    mad = float(np.median(np.abs(lower - med)))
    return med, mad


def derive_sheet_thresholds(row_metrics):
    """
    Adaptive per-sheet thresholds using robust statistics.
    Keeps tight clamped ranges so behavior stays stable.
    """
    max_dens = [m["max_d"] for m in row_metrics]
    max_dark = [m["max_dark"] for m in row_metrics]

    med_d, mad_d = _robust_noise_floor(max_dens)
    med_k, mad_k = _robust_noise_floor(max_dark)

    # Adaptive floor = background center + margin from spread.
    adaptive_fill = med_d + 3.5 * mad_d
    adaptive_dark = med_k + 3.0 * mad_k

    # Clamp to safe operational ranges.
    fill_thr = float(min(0.28, max(0.16, adaptive_fill)))
    dark_thr = float(min(0.30, max(0.14, adaptive_dark)))

    # Strong gates track regular gates with minimum offsets.
    strong_fill = float(min(0.45, max(0.30, fill_thr + 0.10)))
    strong_dark = float(min(0.55, max(0.32, dark_thr + 0.12)))
    dom_ratio = float(min(3.0, max(2.1, DOMINANCE_RATIO)))

    return {
        "fill_threshold": fill_thr,
        "darkness_threshold": dark_thr,
        "strong_fill": strong_fill,
        "strong_darkness": strong_dark,
        "dominance_ratio": dom_ratio,
    }


def pick_answer(densities, darknesses=None):
    """
    Select the answered bubble from a row's ink-density list.

    Decision rules (in order):
    1. If max density < FILL_THRESHOLD  →  blank  (no answer)
    2. If winner ≥ STRONG_FILL AND second < WEAK_FILL  →  accept unconditionally
    3. If winner ≥ DOMINANCE_RATIO × second  →  accept
    4. Otherwise  →  blank  (ambiguous / erased / dirty)

    Returns the letter string ("A"/"B"/"C"/"D") or "" for blank.
    """
    if not densities or all(d <= 0 for d in densities):
        return ""

    bi    = int(np.argmax(densities))
    max_d = densities[bi]
    max_dark = darknesses[bi] if darknesses and bi < len(darknesses) else 0.0

    # Rule 1 — absolute minimum fill
    if max_d < FILL_THRESHOLD or max_dark < DARKNESS_THRESHOLD:
        return ""

    others = [d for i, d in enumerate(densities) if i != bi]
    second = max(others) if others else 0.0

    # Rule 2 — strong unambiguous fill
    if max_d >= STRONG_FILL and max_dark >= STRONG_DARKNESS and second < WEAK_FILL:
        return RTL_MAP[bi]

    # Rule 3 — dominance ratio
    if second < 0.001 or max_d >= DOMINANCE_RATIO * second:
        return RTL_MAP[bi]

    # Rule 4 — ambiguous row must remain blank.
    return ""


def evaluate_row(densities, darknesses, thresholds):
    """
    Return row decision with confidence and review signal.
    """
    if not densities or all(d <= 0 for d in densities):
        return "", 0.0, True

    bi = int(np.argmax(densities))
    max_d = float(densities[bi])
    max_dark = float(darknesses[bi]) if darknesses and bi < len(darknesses) else 0.0
    others = [float(d) for i, d in enumerate(densities) if i != bi]
    second = max(others) if others else 0.0
    second_idx = int(np.argsort(densities)[-2]) if len(densities) > 1 else bi
    second_dark = float(darknesses[second_idx]) if darknesses and second_idx < len(darknesses) else 0.0

    fill_thr = thresholds["fill_threshold"]
    dark_thr = thresholds["darkness_threshold"]
    strong_fill = thresholds["strong_fill"]
    strong_dark = thresholds["strong_darkness"]
    dom_ratio = thresholds["dominance_ratio"]

    if max_d < fill_thr or max_dark < dark_thr:
        # High blank confidence when both are far below threshold.
        blank_margin = max((fill_thr - max_d), 0.0) + max((dark_thr - max_dark), 0.0)
        conf_blank = float(min(1.0, 0.55 + 1.6 * blank_margin))
        return "", conf_blank, conf_blank < 0.75

    ratio = (max_d / max(second, 1e-6))
    pass_strong = (max_d >= strong_fill and max_dark >= strong_dark and second < WEAK_FILL)
    pass_ratio = (second < 0.001 or max_d >= dom_ratio * second)
    # Erase-aware rule:
    # Old erased choice often leaves binary density residue but weak grayscale darkness.
    # If winner is much darker than 2nd option, accept winner.
    pass_erase_aware = (
        max_d >= fill_thr + 0.03 and
        max_dark >= dark_thr + 0.10 and
        (max_dark - second_dark) >= 0.16 and
        (max_d - second) >= 0.03
    )
    accepted = pass_strong or pass_ratio or pass_erase_aware

    if not accepted:
        return "", 0.35, True

    # Confidence combines margin above thresholds + dominance + darkness.
    fill_score = min(1.0, max(0.0, (max_d - fill_thr) / max(1e-6, (strong_fill - fill_thr))))
    dark_score = min(1.0, max(0.0, (max_dark - dark_thr) / max(1e-6, (strong_dark - dark_thr))))
    dom_score = min(1.0, max(0.0, ratio / max(1e-6, dom_ratio)))
    confidence = float(0.40 * fill_score + 0.30 * dark_score + 0.30 * dom_score)

    # Review if weak confidence even after acceptance.
    # If accepted by erase-aware path only, keep review if confidence is moderate.
    if pass_erase_aware and not (pass_strong or pass_ratio):
        needs_review = confidence < 0.82
    else:
        needs_review = confidence < 0.70
    return RTL_MAP[bi], confidence, needs_review


def merge_double_pass(primary, secondary):
    """
    Merge two OMR passes. Any disagreement is pushed to review.
    """
    answers = {}
    confidence = {}
    needs_review = set(primary.get("needs_review_questions", []))
    mismatch = []

    q_keys = sorted(primary["answers"].keys(), key=lambda x: int(x))
    for q in q_keys:
        a1 = primary["answers"].get(q, "")
        a2 = secondary["answers"].get(q, "")
        c1 = float(primary["confidence"].get(q, 0.0))
        c2 = float(secondary["confidence"].get(q, 0.0))

        if a1 == a2:
            answers[q] = a1
            confidence[q] = round(max(c1, c2), 3)
            if abs(c1 - c2) > 0.30:
                needs_review.add(int(q))
        else:
            # Disagreement means not safe for auto grading.
            answers[q] = ""
            confidence[q] = round(min(c1, c2), 3)
            needs_review.add(int(q))
            mismatch.append(int(q))

    if secondary.get("needs_review_questions"):
        needs_review.update(int(x) for x in secondary["needs_review_questions"])

    avg_conf = float(np.mean(list(confidence.values()))) if confidence else 0.0
    quality_flags = []
    if mismatch:
        quality_flags.append("double_pass_mismatch")
    if not primary.get("student_id"):
        quality_flags.append("missing_qr")

    if quality_flags and "missing_qr" in quality_flags and avg_conf < 0.55:
        decision = "REJECTED_QUALITY"
    elif needs_review:
        decision = "REVIEW_REQUIRED"
    else:
        decision = "AUTO_ACCEPTED"

    return {
        "answers": answers,
        "confidence": confidence,
        "needs_review_questions": sorted(needs_review),
        "decision_status": decision,
        "quality_flags": quality_flags,
        "double_pass_mismatch_questions": mismatch,
        "average_confidence": round(avg_conf, 3),
    }


def _append_audit_log(entry):
    try:
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


def parse_qr_payload(qr_text):
    """
    Backward compatible QR parser.
    Supports:
      - plain student id string
      - JSON payload: {"id":"...","nq":20,"tpl":"default"}
    """
    if not qr_text:
        return {"student_id": "", "num_questions": None, "template": None, "raw": ""}
    raw = str(qr_text).strip()
    student_id = raw
    num_questions = None
    template = None
    try:
        if raw.startswith("{") and raw.endswith("}"):
            obj = json.loads(raw)
            student_id = str(obj.get("id", "")).strip() or student_id
            nq = obj.get("nq", None)
            if isinstance(nq, int):
                num_questions = nq
            elif isinstance(nq, str) and nq.isdigit():
                num_questions = int(nq)
            tpl = obj.get("tpl", None)
            if tpl is not None:
                template = str(tpl).strip() or None
    except Exception:
        pass
    return {
        "student_id": student_id,
        "num_questions": num_questions,
        "template": template,
        "raw": raw,
    }


def assess_image_quality(gray_img):
    """
    Basic quality gate to avoid grading low-quality scans.
    Returns (score, flags).
    """
    flags = []
    lap_var = float(cv2.Laplacian(gray_img, cv2.CV_64F).var())
    contrast_std = float(np.std(gray_img))
    p10 = float(np.percentile(gray_img, 10))
    p90 = float(np.percentile(gray_img, 90))
    dynamic_range = p90 - p10

    if lap_var < 22.0:
        flags.append("low_sharpness")
    if contrast_std < 22.0:
        flags.append("low_contrast")
    if dynamic_range < 48.0:
        flags.append("low_dynamic_range")

    # Score in [0,1], higher is better.
    sharp_score = min(1.0, lap_var / 60.0)
    contrast_score = min(1.0, contrast_std / 45.0)
    range_score = min(1.0, dynamic_range / 90.0)
    score = float(0.45 * sharp_score + 0.30 * contrast_score + 0.25 * range_score)
    return score, flags


def build_system_view_image(warped_gray, annotated_proc_bgr):
    """
    Build a compact data-url preview representing what OMR "sees":
    left = aligned grayscale, right = contrast-enhanced preprocessing.
    """
    try:
        if warped_gray is None or annotated_proc_bgr is None:
            return ""
        left = warped_gray
        right = annotated_proc_bgr
        if len(left.shape) == 2:
            left = cv2.cvtColor(left, cv2.COLOR_GRAY2BGR)
        combo = np.hstack([left, right])
        h, w = combo.shape[:2]
        max_w = 1400
        if w > max_w:
            scale = max_w / float(w)
            combo = cv2.resize(combo, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", combo, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        if not ok:
            return ""
        return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    except Exception:
        return ""


def build_annotated_proc_view(proc_gray, row_data, answers, needs_review_questions, y_start, row_sp, per_col, L_XS, R_XS):
    """
    Draw OMR detection marks on top of the preprocessed image:
    - all bubble centers in light cyan
    - selected bubble in green (or amber if needs review)
    """
    if proc_gray is None:
        return None
    if len(proc_gray.shape) == 2:
        vis = cv2.cvtColor(proc_gray, cv2.COLOR_GRAY2BGR)
    else:
        vis = proc_gray.copy()

    letter_to_idx = {"A": 0, "B": 1, "C": 2, "D": 3}
    review_set = set(needs_review_questions or [])

    for row in row_data:
        q = int(row.get("q", 0))
        if q <= 0:
            continue
        is_left = (q - 1) >= per_col
        row_idx = (q - 1) % per_col
        y_center = int(y_start + row_idx * row_sp)
        xs = L_XS if is_left else R_XS

        # Base markers for all candidate bubbles.
        for x in xs:
            cv2.circle(vis, (int(x), y_center), 10, (230, 220, 120), 2)

        # Highlight detected answer.
        ans = str((answers or {}).get(str(q), "")).upper()
        if ans in letter_to_idx and letter_to_idx[ans] < len(xs):
            pick_x = int(xs[letter_to_idx[ans]])
            color = (0, 190, 255) if q in review_set else (0, 200, 0)
            cv2.circle(vis, (pick_x, y_center), 18, color, 3)
            cv2.circle(vis, (pick_x, y_center), 5, color, -1)

        # Question id for quick tracking.
        cv2.putText(vis, f"Q{q}", (int(max(xs) + 16), y_center + 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (50, 80, 240), 1, cv2.LINE_AA)

    return vis


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Column / Row Geometry (per template)
# ══════════════════════════════════════════════════════════════════════════════

def get_bubble_grid_default():
    """
    Mirrors generator.py draw_questions_section() exactly.
    Returns (R_XS, L_XS, y_start, row_spacing, bubble_radius, y_tol)
    """
    half    = (WIDTH - 2 * MARGIN) // 2   # 1090
    GAP     = 60
    col_w   = half - GAP // 2             # 1060
    NUM_AREA = 120

    r_col_x = MARGIN + half + GAP // 2     # 1270
    l_col_x = MARGIN                       # 150

    r_bub_right = (r_col_x + col_w - 10) - NUM_AREA
    l_bub_right = (l_col_x + col_w - 10) - NUM_AREA

    R_XS = [r_bub_right - j * QS_OPT_SPACING for j in range(4)]
    L_XS = [l_bub_right - j * QS_OPT_SPACING for j in range(4)]

    return R_XS, L_XS, QS_START_Y, QS_ROW_SPACING, QS_BUBBLE_R, 28


def get_bubble_grid_nafs():
    """
    Mirrors generator_nafs.py draw_questions_section().
    """
    half     = (WIDTH - 2 * MARGIN) // 2   # 1090
    GAP      = 60
    col_w    = half - GAP // 2             # 1060
    NUM_AREA = 120

    r_col_x = MARGIN + half + GAP // 2     # 1270
    l_col_x = MARGIN                       # 150

    r_bub_right = (r_col_x + col_w - 10) - NUM_AREA
    l_bub_right = (l_col_x + col_w - 10) - NUM_AREA

    R_XS = [r_bub_right - j * QS_OPT_SPACING for j in range(4)]
    L_XS = [l_bub_right - j * QS_OPT_SPACING for j in range(4)]

    return R_XS, L_XS, QS_START_Y, QS_ROW_SPACING, QS_BUBBLE_R, 28


def get_bubble_grid_elite():
    """
    Mirrors generator_elite.py layout.
    Q1-15 → RIGHT column  |  Q16-30 → LEFT column
    """
    row_spacing = 120
    y0          = MARGIN + 850   # first bubble Y = 1000
    col_w       = (WIDTH - 2 * MARGIN) // 2   # 1090

    r_col_x = MARGIN + col_w + 40   # 1280
    l_col_x = MARGIN                # 150

    R_XS = [r_col_x + col_w - 120 - j * 120 for j in range(4)]
    L_XS = [l_col_x + col_w - 120 - j * 120 for j in range(4)]

    return R_XS, L_XS, y0, row_spacing, 35, 28


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Main Entry Point
# ══════════════════════════════════════════════════════════════════════════════

def _scan_omr_single(
    image_path_or_bytes,
    is_bytes=False,
    style="default",
    from_scanner=False,
    num_questions=30,
    sensitivity="normal",
    enable_stability=True,
):
    # ── 0. Read image ────────────────────────────────────────────────────────
    if is_bytes:
        np_arr = np.frombuffer(image_path_or_bytes, np.uint8)
        img    = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    else:
        # Try frombuffer first (handles unicode paths & BMP correctly)
        try:
            raw = np.fromfile(image_path_or_bytes, dtype=np.uint8)
            img = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        except Exception:
            img = None
        # Fallback: PIL can always open BMP / any format
        if img is None:
            try:
                from PIL import Image as PILImage
                pil = PILImage.open(image_path_or_bytes).convert("RGB")
                img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
            except Exception:
                pass
        if img is None:
            img = cv2.imread(str(image_path_or_bytes))

    if img is None:
        raise ValueError(f"Image reading failed: {image_path_or_bytes}")

    # ── 0b. Auto-rotate portrait if landscape ────────────────────────────────
    h0, w0 = img.shape[:2]
    if w0 > h0:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── 1. Alignment strategy ────────────────────────────────────────────────
    #   • from_scanner=True  → image already fills the frame; contour detection
    #     would return None or fail. Go straight to resize + corner markers.
    #   • from_scanner=False → uploaded photo/image; use paper-contour warp.
    if from_scanner:
        # Scanner images already fill the frame — just resize to canonical size
        warped      = cv2.resize(img,  (WIDTH, HEIGHT))
        warped_gray = cv2.resize(gray, (WIDTH, HEIGHT))
    else:
        paper_cnt = get_paper_contour(gray)
        if paper_cnt is not None:
            pts  = paper_cnt.reshape(4, 2)
            rect = order_points(pts)
            M    = cv2.getPerspectiveTransform(
                rect,
                np.array([[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]],
                         dtype="float32"))
            warped = cv2.warpPerspective(img, M, (WIDTH, HEIGHT))
        else:
            warped = cv2.resize(img, (WIDTH, HEIGHT))
        warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

    # ── 2. Fine alignment: corner-marker refinement ──────────────────────────
    #   This is especially critical for scanner images where the paper never
    #   has a visible border, so the only reliable anchors are the printed
    #   corner squares.
    warped, warped_gray = refine_warp_with_markers(warped, warped_gray)

    # If corner markers not found on scanner image, try mild bilateral filter
    # then attempt refinement once more
    if from_scanner:
        corners_found = find_corner_markers(warped_gray)
        if corners_found is None:
            enhanced = cv2.bilateralFilter(warped_gray, 9, 75, 75)
            _, tmp_bin = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            # Use enhanced gray for corner detection
            warped_gray_enh = enhanced
            warped_enh_color = cv2.cvtColor(warped_gray_enh, cv2.COLOR_GRAY2BGR)
            warped, warped_gray = refine_warp_with_markers(warped, warped_gray_enh)

    cv2.imwrite(os.path.join(DEBUG_DIR, "last_warped.png"), warped)

    # ── 3. Preprocessing: CLAHE for uniform contrast ─────────────────────────
    # For scanner images bump clipLimit to handle drum-scanner brightness ramp
    if from_scanner:
        clahe2    = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
        proc_gray = clahe2.apply(warped_gray)
    else:
        proc_gray = preprocess(warped_gray)

    quality_score, quality_flags = assess_image_quality(warped_gray)
    base_proc_vis = cv2.cvtColor(proc_gray, cv2.COLOR_GRAY2BGR) if len(proc_gray.shape) == 2 else proc_gray
    system_view_image = build_system_view_image(warped_gray, base_proc_vis)

    # ── 4. QR / student-ID detection ─────────────────────────────────────────
    student_id = ""
    qr_payload = ""
    if decode_qr:
        # Try full image first, then top half
        for roi_img in [warped, warped[0:1400, :]]:
            results = decode_qr(roi_img)
            if results:
                qr_payload = results[0].data.decode("utf-8")
                break
    if not qr_payload:
        qrd = cv2.QRCodeDetector()
        for roi_img in [warped, warped[0:1400, :]]:
            sid, _, _ = qrd.detectAndDecode(roi_img)
            if sid:
                qr_payload = sid
                break
    qr_meta = parse_qr_payload(qr_payload)
    student_id = qr_meta["student_id"]

    # ── 5. Select geometry based on template style ───────────────────────────
    if style == "elite":
        R_XS, L_XS, y_start, row_sp, bub_r, y_tol = get_bubble_grid_elite()
    elif style == "nafs":
        R_XS, L_XS, y_start, row_sp, bub_r, y_tol = get_bubble_grid_nafs()
    else:
        R_XS, L_XS, y_start, row_sp, bub_r, y_tol = get_bubble_grid_default()

    quality_gate_min = 0.35 if sensitivity != "sensitive" else 0.30
    if quality_score < quality_gate_min:
        blank_answers = {str(i + 1): "" for i in range(num_questions)}
        blank_conf = {str(i + 1): 0.0 for i in range(num_questions)}
        return {
            "student_id": student_id,
            "qr_meta": qr_meta,
            "answers": blank_answers,
            "confidence": blank_conf,
            "needs_review_questions": list(range(1, num_questions + 1)),
            "adaptive_thresholds": {
                "fill": 0.0,
                "darkness": 0.0,
                "strong_fill": 0.0,
                "strong_darkness": 0.0,
                "dominance_ratio": 0.0,
            },
            "quality_score": round(quality_score, 3),
            "quality_flags": quality_flags + ["quality_gate_reject"],
            "unstable_questions": list(range(1, num_questions + 1)),
            "system_view_image": system_view_image,
            "status": "success",
        }

    # ── 6. Scan questions (only up to num_questions) ────────────────────────
    # num_questions is passed from the API based on the exam configuration.
    # This allows 20-question exams to only read 20 bubbles on a 30-bubble sheet.
    # First pass: gather per-row metrics so we can adapt thresholds per sheet.
    row_data = []
    per_col = (num_questions + 1) // 2   # questions per column (ceiling)
    for q in range(num_questions):
        is_left  = q >= per_col
        row_idx  = q % per_col
        y_center = y_start + row_idx * row_sp

        xs = L_XS if is_left else R_XS
        dens = row_densities(proc_gray, xs, y_center, bub_r, y_tol)
        darks = row_darknesses(warped_gray, xs, y_center, bub_r, y_tol)
        if dens:
            bi = int(np.argmax(dens))
            max_d = float(dens[bi])
            max_dark = float(darks[bi]) if darks and bi < len(darks) else 0.0
        else:
            max_d = 0.0
            max_dark = 0.0
        row_data.append({
            "q": q + 1,
            "dens": dens,
            "darks": darks,
            "max_d": max_d,
            "max_dark": max_dark,
        })

    thresholds = derive_sheet_thresholds(row_data)
    if sensitivity == "strict":
        thresholds["fill_threshold"] = min(0.34, thresholds["fill_threshold"] + 0.02)
        thresholds["darkness_threshold"] = min(0.36, thresholds["darkness_threshold"] + 0.02)
        thresholds["dominance_ratio"] = min(3.2, thresholds["dominance_ratio"] + 0.2)
    elif sensitivity == "sensitive":
        thresholds["fill_threshold"] = max(0.12, thresholds["fill_threshold"] - 0.02)
        thresholds["darkness_threshold"] = max(0.10, thresholds["darkness_threshold"] - 0.02)
        thresholds["dominance_ratio"] = max(1.9, thresholds["dominance_ratio"] - 0.2)

    # Second pass: apply decision with confidence + review tagging.
    answers = {}
    confidence_by_question = {}
    needs_review_questions = []
    unstable_questions = []
    for row in row_data:
        q = row["q"]
        ans, conf, needs_review = evaluate_row(row["dens"], row["darks"], thresholds)

        # Stability check: re-evaluate around nearby row centers.
        if enable_stability and row["dens"]:
            row_idx = (q - 1) % per_col
            y_center = y_start + row_idx * row_sp
            is_left = (q - 1) >= per_col
            xs = L_XS if is_left else R_XS
            jitter_answers = []
            for y_shift in (-6, 0, 6):
                d2 = row_densities(proc_gray, xs, y_center + y_shift, bub_r, max(12, y_tol // 2))
                k2 = row_darknesses(warped_gray, xs, y_center + y_shift, bub_r, max(12, y_tol // 2))
                a2, _, _ = evaluate_row(d2, k2, thresholds)
                jitter_answers.append(a2)
            if len(set(jitter_answers)) > 1:
                needs_review = True
                conf = min(conf, 0.68)
                unstable_questions.append(q)

        answers[str(q)] = ans
        confidence_by_question[str(q)] = round(conf, 3)
        if needs_review:
            needs_review_questions.append(q)

    annotated_proc = build_annotated_proc_view(
        proc_gray=proc_gray,
        row_data=row_data,
        answers=answers,
        needs_review_questions=needs_review_questions,
        y_start=y_start,
        row_sp=row_sp,
        per_col=per_col,
        L_XS=L_XS,
        R_XS=R_XS,
    )
    system_view_image = build_system_view_image(warped_gray, annotated_proc)

    return {
        "student_id": student_id,
        "qr_meta": qr_meta,
        "answers":    answers,
        "confidence": confidence_by_question,
        "needs_review_questions": needs_review_questions,
        "quality_score": round(quality_score, 3),
        "quality_flags": quality_flags,
        "unstable_questions": unstable_questions,
        "adaptive_thresholds": {
            "fill": round(thresholds["fill_threshold"], 4),
            "darkness": round(thresholds["darkness_threshold"], 4),
            "strong_fill": round(thresholds["strong_fill"], 4),
            "strong_darkness": round(thresholds["strong_darkness"], 4),
            "dominance_ratio": round(thresholds["dominance_ratio"], 4),
        },
        "system_view_image": system_view_image,
        "status":     "success",
    }


def scan_omr(image_path_or_bytes, is_bytes=False, style="default", from_scanner=False, num_questions=30):
    return scan_omr_with_mode(
        image_path_or_bytes,
        is_bytes=is_bytes,
        style=style,
        from_scanner=from_scanner,
        num_questions=num_questions,
        scan_mode="strict",
    )


def scan_omr_with_mode(image_path_or_bytes, is_bytes=False, style="default", from_scanner=False, num_questions=30, scan_mode="strict"):
    mode = (scan_mode or "strict").lower()
    if mode not in ("fast", "strict", "hybrid"):
        mode = "strict"

    # Fast mode: single pass with lighter checks.
    if mode == "fast":
        fast_pass = _scan_omr_single(
            image_path_or_bytes,
            is_bytes=is_bytes,
            style=style,
            from_scanner=from_scanner,
            num_questions=num_questions,
            sensitivity="sensitive",
            enable_stability=False,
        )
        quality_flags = list(fast_pass.get("quality_flags", []))
        detected_nq = (fast_pass.get("qr_meta", {}) or {}).get("num_questions", None)
        if isinstance(detected_nq, int) and detected_nq > 0 and int(detected_nq) != int(num_questions):
            quality_flags.append("num_questions_mismatch")
        decision_status = "REVIEW_REQUIRED" if fast_pass.get("needs_review_questions") else "AUTO_ACCEPTED"
        if "quality_gate_reject" in quality_flags or "num_questions_mismatch" in quality_flags:
            decision_status = "REJECTED_QUALITY"

        result = {
            "student_id": fast_pass.get("student_id", ""),
            "qr_payload_raw": (fast_pass.get("qr_meta", {}) or {}).get("raw", ""),
            "detected_num_questions": detected_nq,
            "answers": fast_pass.get("answers", {}),
            "confidence": fast_pass.get("confidence", {}),
            "needs_review_questions": fast_pass.get("needs_review_questions", []),
            "adaptive_thresholds": fast_pass.get("adaptive_thresholds", {}),
            "decision_status": decision_status,
            "quality_flags": quality_flags,
            "quality_score": fast_pass.get("quality_score", 0.0),
            "unstable_questions": fast_pass.get("unstable_questions", []),
            "double_pass_mismatch_questions": [],
            "system_view_image": fast_pass.get("system_view_image", ""),
            "average_confidence": round(float(np.mean(list((fast_pass.get("confidence", {}) or {"0": 0.0}).values()))), 3) if fast_pass.get("confidence") else 0.0,
            "processing_mode": "fast",
            "final_verified": False,
            "status": "success",
        }
        _append_audit_log({
            "ts": datetime.utcnow().isoformat() + "Z",
            "student_id": result["student_id"],
            "decision_status": result["decision_status"],
            "num_questions": int(num_questions),
            "needs_review_count": len(result["needs_review_questions"]),
            "average_confidence": result["average_confidence"],
            "quality_flags": result["quality_flags"],
            "processing_mode": "fast",
        })
        return result

    # Run two passes (normal + strict) and merge for safer decisions.
    pass_primary = _scan_omr_single(
        image_path_or_bytes,
        is_bytes=is_bytes,
        style=style,
        from_scanner=from_scanner,
        num_questions=num_questions,
        sensitivity="normal",
        enable_stability=True,
    )

    # Hybrid mode: if initial pass is clearly safe, skip strict pass.
    if mode == "hybrid":
        quick_safe = (
            float(pass_primary.get("quality_score", 0.0)) >= 0.55 and
            len(pass_primary.get("needs_review_questions", [])) == 0
        )
        if quick_safe:
            quality_flags = list(pass_primary.get("quality_flags", []))
            detected_nq = (pass_primary.get("qr_meta", {}) or {}).get("num_questions", None)
            if isinstance(detected_nq, int) and detected_nq > 0 and int(detected_nq) != int(num_questions):
                quality_flags.append("num_questions_mismatch")
            decision_status = "AUTO_ACCEPTED"
            if "quality_gate_reject" in quality_flags or "num_questions_mismatch" in quality_flags:
                decision_status = "REJECTED_QUALITY"

            result = {
                "student_id": pass_primary.get("student_id", ""),
                "qr_payload_raw": (pass_primary.get("qr_meta", {}) or {}).get("raw", ""),
                "detected_num_questions": detected_nq,
                "answers": pass_primary.get("answers", {}),
                "confidence": pass_primary.get("confidence", {}),
                "needs_review_questions": pass_primary.get("needs_review_questions", []),
                "adaptive_thresholds": pass_primary.get("adaptive_thresholds", {}),
                "decision_status": decision_status,
                "quality_flags": quality_flags,
                "quality_score": pass_primary.get("quality_score", 0.0),
                "unstable_questions": pass_primary.get("unstable_questions", []),
                "double_pass_mismatch_questions": [],
                "system_view_image": pass_primary.get("system_view_image", ""),
                "average_confidence": round(float(np.mean(list((pass_primary.get("confidence", {}) or {"0": 0.0}).values()))), 3) if pass_primary.get("confidence") else 0.0,
                "processing_mode": "hybrid-fast-accepted",
                "final_verified": False,
                "status": "success",
            }
            _append_audit_log({
                "ts": datetime.utcnow().isoformat() + "Z",
                "student_id": result["student_id"],
                "decision_status": result["decision_status"],
                "num_questions": int(num_questions),
                "needs_review_count": len(result["needs_review_questions"]),
                "average_confidence": result["average_confidence"],
                "quality_flags": result["quality_flags"],
                "processing_mode": "hybrid-fast-accepted",
            })
            return result

    pass_secondary = _scan_omr_single(
        image_path_or_bytes,
        is_bytes=is_bytes,
        style=style,
        from_scanner=from_scanner,
        num_questions=num_questions,
        sensitivity="strict",
        enable_stability=True,
    )

    merged = merge_double_pass(pass_primary, pass_secondary)
    qr_meta = pass_primary.get("qr_meta", {}) or {}

    # Build image hash for audit traceability.
    img_hash = ""
    try:
        if is_bytes and isinstance(image_path_or_bytes, (bytes, bytearray)):
            img_hash = hashlib.sha256(image_path_or_bytes).hexdigest()
        elif isinstance(image_path_or_bytes, str) and os.path.exists(image_path_or_bytes):
            with open(image_path_or_bytes, "rb") as f:
                img_hash = hashlib.sha256(f.read()).hexdigest()
    except Exception:
        img_hash = ""

    quality_flags = list(merged["quality_flags"])
    quality_flags.extend(pass_primary.get("quality_flags", []))
    quality_score = float(pass_primary.get("quality_score", 0.0))
    detected_nq = qr_meta.get("num_questions", None)
    if isinstance(detected_nq, int) and detected_nq > 0 and int(detected_nq) != int(num_questions):
        quality_flags.append("num_questions_mismatch")
    if quality_score < 0.35 and "quality_gate_reject" not in quality_flags:
        quality_flags.append("quality_gate_reject")
    result = {
        "student_id": pass_primary.get("student_id", ""),
        "qr_payload_raw": qr_meta.get("raw", ""),
        "detected_num_questions": detected_nq,
        "answers": merged["answers"],
        "confidence": merged["confidence"],
        "needs_review_questions": merged["needs_review_questions"],
        "adaptive_thresholds": pass_primary.get("adaptive_thresholds", {}),
        "decision_status": "REJECTED_QUALITY" if ("num_questions_mismatch" in quality_flags or "quality_gate_reject" in quality_flags) else merged["decision_status"],
        "quality_flags": quality_flags,
        "quality_score": round(quality_score, 3),
        "unstable_questions": pass_primary.get("unstable_questions", []),
        "double_pass_mismatch_questions": merged["double_pass_mismatch_questions"],
        "system_view_image": pass_primary.get("system_view_image", ""),
        "average_confidence": merged["average_confidence"],
        "processing_mode": "strict" if mode == "strict" else "hybrid-strict-fallback",
        "final_verified": True,
        "status": "success",
    }

    _append_audit_log({
        "ts": datetime.utcnow().isoformat() + "Z",
        "student_id": result["student_id"],
        "decision_status": result["decision_status"],
        "num_questions": int(num_questions),
        "needs_review_count": len(result["needs_review_questions"]),
        "average_confidence": result["average_confidence"],
        "quality_flags": result["quality_flags"],
        "image_sha256": img_hash,
        "answers": result["answers"],
        "processing_mode": result["processing_mode"],
    })
    return result


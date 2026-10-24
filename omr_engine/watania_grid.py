# -*- coding: utf-8 -*-
"""
Recover the ministry national-exam bubble lattices from printed circles.

The official sheet is printed by the ministry (not by our generator), so its
geometry differs from omr_watania.py and scans are often slightly rotated.
We detect circles, find rows with the expected structure (3×4 options for
answers, 10+6 digits for the ID block), then fit a sheared lattice
(shared x-slope per column, shared y-slope per row) so every centre follows
the page tilt.
"""
import cv2
import numpy as np


def hough_points(gray, y_lo=0, y_hi=None, min_r=12, max_r=32):
    h, w = gray.shape[:2]
    y_hi = h if y_hi is None else min(h, int(y_hi))
    y_lo = max(0, int(y_lo))
    roi = cv2.GaussianBlur(gray[y_lo:y_hi, :], (5, 5), 1.1)
    best = []
    for p2 in (15, 12, 18):
        c = cv2.HoughCircles(
            roi, cv2.HOUGH_GRADIENT, dp=1.2, minDist=int(min_r * 1.6),
            param1=70, param2=p2, minRadius=min_r, maxRadius=max_r,
        )
        pts = [] if c is None else [
            (float(x), float(y) + y_lo, float(r)) for x, y, r in c[0]
        ]
        if len(pts) > len(best):
            best = pts
        if len(pts) >= 250:
            break
    if not best:
        return []
    r_med = float(np.median([p[2] for p in best]))
    return [p for p in best if abs(p[2] - r_med) <= max(4.0, 0.3 * r_med)]


def cluster_rows(pts, tol):
    """Group points into rows without chaining (compare to running mean)."""
    rows = []
    for p in sorted(pts, key=lambda t: t[1]):
        if rows and abs(p[1] - rows[-1]["y"]) <= tol:
            rows[-1]["pts"].append(p)
            rows[-1]["y"] = float(np.mean([q[1] for q in rows[-1]["pts"]]))
        else:
            rows.append({"y": p[1], "pts": [p]})
    return rows


def estimate_pitch(rows, r_med):
    gaps = []
    for row in rows:
        xs = sorted(p[0] for p in row["pts"])
        gaps.extend(g for g in np.diff(xs) if 2.4 * r_med < g < 6.0 * r_med)
    return float(np.median(gaps)) if gaps else 3.8 * r_med


def pitch_candidates(rows, r_med, max_n=3):
    """
    Distinct horizontal spacings present in the band. The ID digit grid and the
    answer options share the search band but have different pitches, so a
    single median can land on the wrong one.
    """
    gaps = []
    for row in rows:
        xs = sorted(p[0] for p in row["pts"])
        gaps.extend(g for g in np.diff(xs) if 2.4 * r_med < g < 6.0 * r_med)
    if not gaps:
        return [3.8 * r_med]
    gaps = np.array(gaps, dtype=float)
    bw = max(2.0, 0.04 * float(np.median(gaps)))
    hist, edges = np.histogram(gaps, bins=np.arange(gaps.min(), gaps.max() + 2 * bw, bw))
    out = []
    for i in np.argsort(hist)[::-1]:
        if hist[i] < 3:
            break
        c = 0.5 * (edges[i] + edges[i + 1])
        near = gaps[np.abs(gaps - c) <= 0.12 * c]
        c = float(np.median(near)) if near.size else c
        if all(abs(c - o) > 0.15 * o for o in out):
            out.append(c)
        if len(out) >= max_n:
            break
    return out or [float(np.median(gaps))]


def _dedupe(pts, min_gap):
    out = []
    for p in sorted(pts, key=lambda t: t[0]):
        if out and p[0] - out[-1][0] < min_gap:
            continue
        out.append(p)
    return out


def row_runs(row_pts, pitch):
    pts = _dedupe(row_pts, 0.5 * pitch)
    runs = []
    for p in pts:
        if runs and p[0] - runs[-1][-1][0] <= 1.5 * pitch:
            runs[-1].append(p)
        else:
            runs.append([p])
    return runs


def best_subrun(run, n, pitch, max_dev=0.25):
    """Pick n consecutive points with spacing ≈ pitch; prefer leftmost on ties."""
    if len(run) < n:
        return None
    best = None
    for k in range(len(run) - n + 1):
        ch = run[k:k + n]
        dev = np.abs(np.diff([p[0] for p in ch]) - pitch) / pitch
        if dev.size and float(dev.max()) > max_dev:
            continue
        score = float(dev.mean()) if dev.size else 0.0
        if best is None or score < best[0] - 1e-6:
            best = (score, ch)
    return None if best is None else best[1]


def _base_spacing(diffs):
    """Row pitch from consecutive gaps; gaps from missing rows are multiples."""
    d = sorted(float(v) for v in diffs)
    base = d[0]
    near = [v for v in d if v < 1.4 * base]
    if len(near) < max(2, len(d) // 3):
        base = float(np.median(d))
        near = [v for v in d if abs(v - base) < 0.3 * base]
    return float(np.median(near)) if near else base


def fit_chains(ys, n, spacing):
    """
    Candidate placements of n equally spaced rows over the observed ys,
    best first. Several placements can explain the same rows when rows at
    the ends were not detected; callers disambiguate with lattice support.
    """
    ys = sorted(ys)
    if len(ys) < max(3, n // 2):
        return []
    tol = 0.3 * spacing
    found = {}
    for y0 in ys:
        for m in range(0, n):
            start = y0 - m * spacing
            idx, obs = [], []
            for k in range(n):
                exp = start + k * spacing
                near = [y for y in ys if abs(y - exp) <= tol]
                if near:
                    idx.append(k)
                    obs.append(min(near, key=lambda y: abs(y - exp)))
            if len(idx) < 3:
                continue
            a, b = np.polyfit(idx, obs, 1)
            resid = float(np.mean(np.abs(np.polyval([a, b], idx) - obs)))
            key = (len(idx), -resid)
            rows = [float(b + a * k) for k in range(n)]
            sig = int(round(rows[0] / (0.5 * spacing)))
            if sig not in found or key > found[sig][0]:
                found[sig] = (key, rows)
    ranked = sorted(found.values(), key=lambda t: t[0], reverse=True)
    if not ranked:
        return []
    top = ranked[0][0][0]
    return [rows for key, rows in ranked if key[0] >= top - 1][:6]


def lattice_support(lattice, pts, radius):
    """How many detected circles sit on predicted centres."""
    if not lattice or not pts:
        return 0
    arr = np.array([(p[0], p[1]) for p in pts], dtype=float)
    hit = 0
    for row in lattice:
        for x, y in row:
            d = np.hypot(arr[:, 0] - x, arr[:, 1] - y)
            if d.size and float(d.min()) <= radius:
                hit += 1
    return hit


def fit_lattice(samples, row_ys, n_cols, x_mid, y_mid):
    """
    samples: list of (row_index, col_index, x, y) from clean rows.
    Returns centres[row][col] as (x, y), or None.
    """
    if len(samples) < n_cols * 2:
        return None
    arr = np.array(samples, dtype=float)
    ri, ci, xs, ys = arr[:, 0].astype(int), arr[:, 1].astype(int), arr[:, 2], arr[:, 3]

    def pooled_slope(group, dep, ind):
        num = den = 0.0
        for g in np.unique(group):
            m = group == g
            if m.sum() < 2:
                continue
            di = ind[m] - ind[m].mean()
            num += float(np.sum(di * (dep[m] - dep[m].mean())))
            den += float(np.sum(di * di))
        return num / den if den > 1e-6 else 0.0

    bx = pooled_slope(ci, xs, ys)  # column drift: dx/dy
    dy = pooled_slope(ri, ys, xs)  # row tilt: dy/dx
    col_x = {}
    for c in range(n_cols):
        m = ci == c
        if not m.any():
            return None
        col_x[c] = float(np.median(xs[m] - bx * (ys[m] - y_mid)))
    row_off = {}
    for r in np.unique(ri):
        m = ri == r
        row_off[int(r)] = float(np.median(ys[m] - dy * (xs[m] - x_mid) - row_ys[int(r)]))
    # rows without clean samples keep the chain position; nudge by median offset
    shift = float(np.median(list(row_off.values()))) if row_off else 0.0
    centres = []
    for r, yr in enumerate(row_ys):
        yr = yr + row_off.get(r, shift)
        row = []
        for c in range(n_cols):
            x = (col_x[c] + bx * (yr - y_mid - dy * x_mid)) / (1.0 - bx * dy)
            y = yr + dy * (x - x_mid)
            row.append((int(round(x)), int(round(y))))
        centres.append(row)
    return centres


def _answer_row_groups(row, pitch, width):
    runs = [r for r in row_runs(row["pts"], pitch) if len(r) >= 4]
    groups = [g for g in (best_subrun(r, 4, pitch) for r in runs) if g]
    if len(groups) != 3:
        return None
    span = groups[-1][-1][0] - groups[0][0][0]
    return groups if span > 0.45 * width else None


def _pitch_rows(rows, pitch, min_hits=3):
    """Rows whose neighbour gaps repeatedly match pitch (drops ID-grid rows)."""
    out = []
    for row in rows:
        xs = [p[0] for p in _dedupe(row["pts"], 0.5 * pitch)]
        hits = sum(1 for g in np.diff(xs) if abs(g - pitch) <= 0.15 * pitch)
        if hits >= min_hits:
            out.append(row)
    return out


def _answer_columns_from_rows(rows, pitch, width):
    """
    12 column x-positions (3 groups × 4, LTR) voted by every row, so rows with
    filled or missed bubbles still contribute. Returns None if no 3 groups fit.
    """
    xs = sorted(p[0] for row in rows for p in row["pts"])
    if len(xs) < 12:
        return None
    clusters = []
    for x in xs:
        if clusters and x - float(np.median(clusters[-1])) <= 0.12 * pitch:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    centres = [(float(np.median(c)), len(c)) for c in clusters if len(c) >= 2]
    if not centres:
        return None
    # Tight: question-number glyphs sit ~0.8 pitch beyond the last option.
    tol = 0.12 * pitch

    def slot(x):
        near = [(abs(cx - x), cx, n) for cx, n in centres if abs(cx - x) <= tol]
        return min(near)[1:] if near else (None, 0)

    groups = []
    for cx, _ in centres:
        slots = [slot(cx + j * pitch) for j in range(4)]
        hit = [s for s in slots if s[0] is not None]
        if len(hit) < 3:
            continue
        pos = [s[0] if s[0] is not None else cx + j * pitch for j, s in enumerate(slots)]
        groups.append((sum(s[1] for s in slots), pos))
    groups.sort(key=lambda g: g[0], reverse=True)
    chosen = []
    for score, pos in groups:
        if all(abs(pos[0] - c[0]) > 4.5 * pitch for _, c in chosen):
            chosen.append((score, pos))
        if len(chosen) == 3:
            break
    if len(chosen) != 3:
        return None
    chosen.sort(key=lambda g: g[1][0])
    cols = [x for _, pos in chosen for x in pos]
    if cols[-1] - cols[0] < 0.45 * width:
        return None
    return cols


def _column_samples(rows, cols, pitch, min_hits=6):
    """(y, [(col_index, x, y), ...]) per row that lands on enough columns."""
    out = []
    for row in rows:
        hits = {}
        for p in row["pts"]:
            d = [abs(p[0] - cx) for cx in cols]
            c = int(np.argmin(d))
            if d[c] <= 0.3 * pitch and (c not in hits or d[c] < abs(hits[c][0] - cols[c])):
                hits[c] = (p[0], p[1])
        if len(hits) >= min_hits:
            ys = [v[1] for v in hits.values()]
            out.append((float(np.median(ys)), [(c, x, y) for c, (x, y) in hits.items()]))
    return out


def recover_answer_lattice(gray):
    """
    Returns dict with 'centres' {q: [(x,y) for أ,ب,ج,د]}, 'bub_r', 'row_ys'.
    Question 1-10 = right group, 11-20 middle, 21-30 left. Within a group
    أ is the rightmost bubble.
    """
    h, w = gray.shape[:2]
    pts = hough_points(gray, h * 0.30, h - 20)
    if len(pts) < 60:
        return None
    r_med = float(np.median([p[2] for p in pts]))
    rows = cluster_rows(pts, tol=1.3 * r_med)

    best = None
    for pitch in pitch_candidates(rows, r_med):
        # Each source: list of (row_y, [(col, x, y), ...]).
        sources = []
        clean = []
        for row in rows:
            g = _answer_row_groups(row, pitch, w)
            if g:
                flat = [p for grp in g for p in grp]  # LTR, 12 bubbles
                clean.append((row["y"], [(c, p[0], p[1]) for c, p in enumerate(flat)]))
        if len(clean) >= 3:
            sources.append(clean)
        # Filled sheets hide circles under pen marks, so full rows are rare.
        prows = _pitch_rows(rows, pitch)
        cols = _answer_columns_from_rows(prows, pitch, w) if len(prows) >= 3 else None
        if cols:
            voted = _column_samples(prows, cols, pitch)
            if len(voted) >= 3:
                sources.append(voted)
        for src in sources:
            ys = [s[0] for s in src]
            diffs = [d for d in np.diff(sorted(ys)) if d > 2.5 * r_med]
            if not diffs:
                continue
            spacing = _base_spacing(diffs)
            for row_ys in fit_chains(ys, 10, spacing):
                samples = []
                for y, hits in src:
                    k = int(np.argmin([abs(y - ry) for ry in row_ys]))
                    if abs(y - row_ys[k]) > 0.3 * spacing:
                        continue
                    samples.extend((k, c, x, yy) for c, x, yy in hits)
                lat = fit_lattice(samples, row_ys, 12, w / 2.0, float(np.mean(row_ys)))
                if lat is None:
                    continue
                support = lattice_support(lat, pts, 0.6 * r_med)
                if best is None or support > best[0]:
                    best = (support, lat, row_ys, spacing, pitch)
    if best is None:
        return None
    _, lattice, row_ys, spacing, pitch = best

    centres = {}
    for q in range(30):
        grp = 2 - q // 10          # q 0-9 -> right group (LTR index 2)
        r = q % 10
        cols = [grp * 4 + j for j in range(4)]
        xy = [lattice[r][c] for c in cols]
        centres[q + 1] = list(reversed(xy))  # أ is rightmost
    return {
        "centres": centres,
        "bub_r": int(round(r_med)),
        "row_ys": row_ys,
        "spacing": spacing,
        "pitch": pitch,
    }


def recover_id_lattices(gray, answer_top=None):
    """
    Returns {'nid': [[(x,y)]*10 cols]*10 rows, 'code': ... 6 cols, 'bub_r'} or None.
    Row r = digit r. Column 0 = leftmost.
    """
    h, w = gray.shape[:2]
    y_hi = answer_top - 60 if answer_top else h * 0.45
    pts = hough_points(gray, h * 0.08, y_hi)
    if len(pts) < 60:
        return None
    r_med = float(np.median([p[2] for p in pts]))

    best = None
    # Digit rows are tightly packed; Hough also fires on the gaps between four
    # circles, and a wide row tolerance chains those into neighbouring rows.
    for row_tol in (0.6 * r_med, 1.1 * r_med):
        rows = cluster_rows(pts, tol=row_tol)
        pitch = estimate_pitch(rows, r_med)

        clean = []
        for row in rows:
            runs = row_runs(row["pts"], pitch)
            nid = code = None
            for run in runs:
                if nid is None and len(run) >= 10:
                    nid = best_subrun(run, 10, pitch, max_dev=0.3)
                    if nid:
                        continue
                if nid is not None and code is None and len(run) >= 6 and run[0][0] > nid[-1][0]:
                    code = best_subrun(run, 6, pitch, max_dev=0.3)
            if nid:
                clean.append((row["y"], nid, code))
        if len(clean) < 3:
            continue
        ys = sorted(c[0] for c in clean)
        diffs = [d for d in np.diff(ys) if d > 2.0 * r_med]
        if not diffs:
            continue
        spacing = _base_spacing(diffs)
        for row_ys in fit_chains(ys, 10, spacing):
            nid_s, code_s = [], []
            for y, nid, code in clean:
                k = int(np.argmin([abs(y - ry) for ry in row_ys]))
                if abs(y - row_ys[k]) > 0.3 * spacing:
                    continue
                nid_s.extend((k, c, p[0], p[1]) for c, p in enumerate(nid))
                if code:
                    code_s.extend((k, c, p[0], p[1]) for c, p in enumerate(code))
            y_mid = float(np.mean(row_ys))
            nid_lat = fit_lattice(nid_s, row_ys, 10, w / 2.0, y_mid)
            if nid_lat is None:
                continue
            code_lat = fit_lattice(code_s, row_ys, 6, w / 2.0, y_mid) if len(code_s) >= 12 else None
            support = lattice_support(nid_lat, pts, 0.6 * r_med) + lattice_support(code_lat, pts, 0.6 * r_med)
            if best is None or support > best[0]:
                best = (support, nid_lat, code_lat)
    if best is None:
        return None
    return {"nid": best[1], "code": best[2], "bub_r": int(round(r_med))}

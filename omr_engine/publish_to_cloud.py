"""نشر الجداول المحلية إلى Supabase بدون صور الأوراق."""
from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

import local_store

TABLES = (
    "students",
    "committees",
    "observers",
    "locations",
    "omr_exams",
    "omr_results",
    "settings",
    "retake_requests",
)

STRIP_KEYS = {
    "created_at",
    "updated_at",
    "portal_national_norm",
    "portal_seat_norm",
    "portal_student_id_norm",
    "portal_detected_id_norm",
    "portal_norm_detected_id_norm",
}

IMAGE_KEYS = {
    "reviewRois",
    "systemViewImage",
    "systemViewImageThumb",
    "sheetImage",
    "scanImage",
    "originalImage",
    "hasSheetImage",
    "systemViewImagePath",
}

CHUNK = 60


def load_env(path: str) -> dict:
    out = {}
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def slim(table: str, row: dict) -> dict:
    payload = dict(row or {})
    payload.pop("id", None)
    for key in STRIP_KEYS:
        payload.pop(key, None)
    if table == "omr_results":
        for key in IMAGE_KEYS:
            payload.pop(key, None)
    return payload


def request(url: str, key: str, method: str = "GET", body=None, extra_headers=None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=90) as resp:
            raw = resp.read()
            return resp.status, raw.decode("utf-8") if raw else ""
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return e.code, raw


def probe(base: str, key: str) -> dict:
    status, text = request(f"{base}/rest/v1/students?select=id&limit=1", key)
    return {"status": status, "body": text[:400]}


def upsert_table(base: str, key: str, table: str, rows: list) -> int:
    if not rows:
        print(f"  تخطي {table}: فارغ")
        return 0
    done = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        payload = [{"id": str(r["id"]), "data": slim(table, r)} for r in chunk if r.get("id")]
        status, text = request(
            f"{base}/rest/v1/{table}?on_conflict=id",
            key,
            method="POST",
            body=payload,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        if status not in (200, 201, 204):
            raise RuntimeError(f"{table} upsert failed ({status}): {text[:500]}")
        done += len(payload)
        print(f"  {table}: {done}/{len(rows)}")
    return done


def main() -> int:
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    env = load_env(env_path)
    base = (env.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = env.get("VITE_SUPABASE_ANON_KEY") or ""
    if not base or not key:
        print("مفاتيح السحابة ناقصة في .env")
        return 1
    print("المشروع:", base)
    print("المحلي:", local_store.data_root())
    info = probe(base, key)
    if info["status"] == 404 or "PGRST" in info["body"] or "Could not find" in info["body"]:
        print("SCHEMA_MISSING")
        print(info)
        return 2
    if info["status"] not in (200, 206):
        print("CLOUD_UNREACHABLE", info)
        return 3
    started = time.time()
    stats = {}
    for table in TABLES:
        rows = local_store.list_rows(table, include_images=False)
        print(f"نشر {table} ({len(rows)})...")
        stats[table] = upsert_table(base, key, table, rows)
    stats["_seconds"] = round(time.time() - started, 1)
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

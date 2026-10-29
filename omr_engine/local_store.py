"""
قاعدة بيانات محلية بديلة عن Supabase.
- SQLite للجداول (id + data)
- صور الأوراق كملفات على القرص وليست داخل الصفوف
المسار الافتراضي: ../local_data بجانب omr_engine حتى لا يعيد uvicorn التحميل عند كل حفظ.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
from typing import Any, Dict, Iterable, List, Optional, Tuple

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

IMAGE_KEYS = (
    "systemViewImage",
    "systemViewImageThumb",
    "sheetImage",
    "scanImage",
    "originalImage",
    "reviewRois",
)

_lock = threading.Lock()
_root_override = None


def data_root() -> str:
    if _root_override:
        return _root_override
    env = os.getenv("ELITE_LOCAL_DATA")
    if env:
        return os.path.abspath(env)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "local_data"))


def set_data_root(path: str) -> None:
    global _root_override
    _root_override = os.path.abspath(path)


def db_path() -> str:
    return os.path.join(data_root(), "elite_local.db")


def sheets_dir() -> str:
    return os.path.join(data_root(), "sheets")


def _connect() -> sqlite3.Connection:
    os.makedirs(data_root(), exist_ok=True)
    os.makedirs(sheets_dir(), exist_ok=True)
    conn = sqlite3.connect(db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _connect()
        try:
            for table in TABLES:
                conn.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{{}}')"
                )
            conn.commit()
        finally:
            conn.close()


def _decode_data_url(value: str) -> Optional[bytes]:
    text = str(value or "").strip()
    if not text.startswith("data:") or "," not in text:
        return None
    import base64

    try:
        return base64.b64decode(text.split(",", 1)[1], validate=False)
    except Exception:
        return None


def _sheet_path(row_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(row_id))
    return os.path.join(sheets_dir(), f"{safe}.jpg")


def extract_images(row_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    out = dict(payload)
    blob = None
    for key in IMAGE_KEYS:
        val = out.pop(key, None)
        if blob is None and isinstance(val, str) and val.startswith("data:image"):
            blob = _decode_data_url(val)
    if blob:
        with open(_sheet_path(row_id), "wb") as fh:
            fh.write(blob)
        out["hasSheetImage"] = True
    elif os.path.isfile(_sheet_path(row_id)):
        out["hasSheetImage"] = True
    return out


def attach_image_flag(row: Dict[str, Any], include_url: bool = True) -> Dict[str, Any]:
    if not row:
        return row
    rid = str(row.get("id") or "")
    if rid and os.path.isfile(_sheet_path(rid)):
        row["hasSheetImage"] = True
        if include_url:
            row["systemViewImagePath"] = f"/store/sheets/{rid}"
    return row


def list_rows(table: str, include_images: bool = False) -> List[Dict[str, Any]]:
    if table not in TABLES:
        raise ValueError(table)
    init_db()
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(f"SELECT id, data FROM {table}")
            rows = []
            for rec in cur.fetchall():
                try:
                    data = json.loads(rec["data"] or "{}")
                except Exception:
                    data = {}
                if not isinstance(data, dict):
                    data = {"value": data}
                row = {"id": rec["id"], **data}
                if table == "omr_results":
                    for key in IMAGE_KEYS:
                        row.pop(key, None)
                    attach_image_flag(row, include_url=include_images)
                rows.append(row)
            return rows
        finally:
            conn.close()


def get_row(table: str, row_id: str) -> Optional[Dict[str, Any]]:
    if table not in TABLES:
        raise ValueError(table)
    init_db()
    with _lock:
        conn = _connect()
        try:
            rec = conn.execute(f"SELECT id, data FROM {table} WHERE id = ?", (str(row_id),)).fetchone()
            if not rec:
                return None
            data = json.loads(rec["data"] or "{}")
            if not isinstance(data, dict):
                data = {}
            row = {"id": rec["id"], **data}
            if table == "omr_results":
                for key in IMAGE_KEYS:
                    row.pop(key, None)
                attach_image_flag(row, include_url=True)
            return row
        finally:
            conn.close()


def upsert_row(table: str, item: Dict[str, Any]) -> Dict[str, Any]:
    if table not in TABLES:
        raise ValueError(table)
    payload = dict(item or {})
    row_id = str(payload.get("id") or "").strip()
    if not row_id:
        raise ValueError("missing id")
    if table == "omr_results":
        payload = extract_images(row_id, payload)
        payload["id"] = row_id
    init_db()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                f"INSERT INTO {table} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                (row_id, json.dumps(payload, ensure_ascii=False)),
            )
            conn.commit()
        finally:
            conn.close()
    return payload


def upsert_many(table: str, items: Iterable[Dict[str, Any]]) -> int:
    count = 0
    for item in items or []:
        if not item:
            continue
        upsert_row(table, item)
        count += 1
    return count


def replace_table(table: str, items: Iterable[Dict[str, Any]]) -> int:
    if table not in TABLES:
        raise ValueError(table)
    init_db()
    with _lock:
        conn = _connect()
        try:
            conn.execute(f"DELETE FROM {table}")
            conn.commit()
        finally:
            conn.close()
    return upsert_many(table, items)


def delete_row(table: str, row_id: str) -> bool:
    if table not in TABLES:
        raise ValueError(table)
    init_db()
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(f"DELETE FROM {table} WHERE id = ?", (str(row_id),))
            conn.commit()
            deleted = cur.rowcount > 0
        finally:
            conn.close()
    if table == "omr_results":
        path = _sheet_path(row_id)
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
    return deleted


def delete_ids(table: str, ids: Iterable[str]) -> int:
    n = 0
    for rid in ids or []:
        if delete_row(table, rid):
            n += 1
    return n


def clear_all() -> None:
    init_db()
    with _lock:
        conn = _connect()
        try:
            for table in TABLES:
                conn.execute(f"DELETE FROM {table}")
            conn.commit()
        finally:
            conn.close()
    folder = sheets_dir()
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            try:
                os.remove(os.path.join(folder, name))
            except OSError:
                pass


def status() -> Dict[str, Any]:
    init_db()
    counts = {}
    with _lock:
        conn = _connect()
        try:
            for table in TABLES:
                counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        finally:
            conn.close()
    sheet_count = 0
    sheet_bytes = 0
    folder = sheets_dir()
    if os.path.isdir(folder):
        for name in os.listdir(folder):
            path = os.path.join(folder, name)
            if os.path.isfile(path):
                sheet_count += 1
                sheet_bytes += os.path.getsize(path)
    db_bytes = os.path.getsize(db_path()) if os.path.isfile(db_path()) else 0
    return {
        "ok": True,
        "backend": "local",
        "root": data_root(),
        "db": db_path(),
        "counts": counts,
        "sheetCount": sheet_count,
        "dbMb": round(db_bytes / (1024 * 1024), 2),
        "sheetsMb": round(sheet_bytes / (1024 * 1024), 2),
    }


def _as_item(row: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(row, dict):
        return None
    if isinstance(row.get("data"), dict):
        item = {**row["data"], "id": str(row.get("id") or row["data"].get("id") or "")}
    else:
        item = dict(row)
    if not item.get("id"):
        return None
    return item


def import_app_backup(payload: Dict[str, Any]) -> Dict[str, int]:
    mapping = {
        "students": "students",
        "committees": "committees",
        "observers": "observers",
        "locations": "locations",
        "omr_exams": "omr_exams",
        "omr_results": "omr_results",
        "retake_requests": "retake_requests",
        "settings": "settings",
    }
    stats = {table: 0 for table in TABLES}
    for key, table in mapping.items():
        rows = payload.get(key)
        if isinstance(rows, list):
            stats[table] = upsert_many(table, [_as_item(r) for r in rows if _as_item(r)])
    if isinstance(payload.get("app_config"), dict):
        upsert_row("settings", {"id": "app_config", **payload["app_config"], "id": "app_config"})
        stats["settings"] += 1
    if isinstance(payload.get("assignments"), dict):
        upsert_row("settings", {"id": "assignments", **payload["assignments"], "id": "assignments"})
        stats["settings"] += 1
    if isinstance(payload.get("omr_subjects"), (list, dict)):
        data = payload["omr_subjects"]
        upsert_row("settings", {"id": "omr_subjects", "subjects": data} if isinstance(data, list) else {"id": "omr_subjects", **data})
        stats["settings"] += 1
    return {k: v for k, v in stats.items() if v}


def import_table_rows(table: str, rows: List[Any]) -> int:
    if table not in TABLES:
        raise ValueError(table)
    items = [_as_item(r) for r in rows]
    return upsert_many(table, [i for i in items if i])


def _split_sql_values(body: str) -> List[str]:
    rows, buf, in_str, i = [], [], False, 0
    while i < len(body):
        ch = body[i]
        if in_str:
            buf.append(ch)
            if ch == "'":
                if i + 1 < len(body) and body[i + 1] == "'":
                    buf.append(body[i + 1])
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if ch == "'":
            in_str = True
            buf.append(ch)
        elif ch == "," and not buf:
            i += 1
            continue
        elif ch == "," and "".join(buf).count("(") == "".join(buf).count(")"):
            rows.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        rows.append(tail)
    return rows


def _sql_unquote(value: str) -> str:
    v = value.strip()
    if v.upper() == "NULL":
        return ""
    if v.startswith("'") and v.endswith("'"):
        return v[1:-1].replace("''", "'")
    return v


def parse_sql_inserts(sql_text: str) -> Dict[str, List[Dict[str, Any]]]:
    text = sql_text
    pattern = re.compile(
        r'INSERT\s+INTO\s+(?:public\.)?"?(?P<table>[a-zA-Z0-9_]+)"?\s*\((?P<cols>[^)]+)\)\s*VALUES\s*(?P<vals>.+?);',
        re.IGNORECASE | re.DOTALL,
    )
    out: Dict[str, List[Dict[str, Any]]] = {}
    for match in pattern.finditer(text):
        table = match.group("table").lower()
        if table not in TABLES:
            continue
        cols = [c.strip().strip('"') for c in match.group("cols").split(",")]
        for raw_row in _split_sql_values(match.group("vals")):
            raw_row = raw_row.strip()
            if raw_row.startswith("(") and raw_row.endswith(")"):
                raw_row = raw_row[1:-1]
            parts = _split_sql_values(raw_row)
            if len(parts) < len(cols):
                continue
            rec = {cols[i]: _sql_unquote(parts[i]) for i in range(len(cols))}
            row_id = rec.get("id") or ""
            data_raw = rec.get("data") or "{}"
            try:
                data = json.loads(data_raw) if data_raw else {}
            except Exception:
                data = {"_raw": data_raw}
            if not isinstance(data, dict):
                data = {}
            if row_id:
                data["id"] = row_id
                out.setdefault(table, []).append(data)
    return out


def import_payload(raw: bytes, filename: str = "") -> Dict[str, Any]:
    name = (filename or "").lower()
    text = raw.decode("utf-8-sig", errors="replace")
    stripped = text.lstrip()
    imported: Dict[str, int] = {}
    if stripped.startswith("{") or stripped.startswith("["):
        payload = json.loads(text)
        if isinstance(payload, list):
            guessed = ""
            for table in TABLES:
                if table in name:
                    guessed = table
                    break
            if not guessed:
                raise ValueError("ملف JSON عبارة عن قائمة بدون اسم جدول. سمِّ الملف مثل omr_results.json")
            imported[guessed] = import_table_rows(guessed, payload)
        elif isinstance(payload, dict) and any(k in payload for k in ("students", "omr_results", "omr_exams", "app_config")):
            imported = import_app_backup(payload)
        elif isinstance(payload, dict) and "id" in payload and "data" in payload:
            table = next((t for t in TABLES if t in name), "")
            if not table:
                raise ValueError("لا يمكن معرفة الجدول من اسم الملف")
            imported[table] = import_table_rows(table, [payload])
        else:
            # { students: [...], ... } or { tableName: {id,data}[] }
            for table in TABLES:
                if isinstance(payload.get(table), list):
                    imported[table] = import_table_rows(table, payload[table])
            if not imported:
                raise ValueError("تنسيق JSON غير معروف")
    else:
        parsed = parse_sql_inserts(text)
        if not parsed:
            raise ValueError("لم يتم العثور على أوامر INSERT في ملف SQL")
        for table, rows in parsed.items():
            imported[table] = import_table_rows(table, rows)
    return {"imported": imported, "status": status()}

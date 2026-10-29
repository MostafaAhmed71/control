"""استيراد ملف pg_dump -Fc (مثل control.backup) إلى القاعدة المحلية."""
from __future__ import annotations

import json
import sys
import time

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


def _parse_data(raw):
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    text = str(raw)
    if not text or text == "\\N":
        return {}
    try:
        out = json.loads(text)
    except Exception:
        return {"_raw": text}
    return out if isinstance(out, dict) else {"value": out}


def import_custom_dump(path: str) -> dict:
    import pgdumplib

    local_store.init_db()
    dump = pgdumplib.load(path)
    stats = {}
    started = time.time()
    for table in TABLES:
        count = 0
        try:
            rows = dump.table_data("public", table)
        except Exception as e:
            print(f"تخطي {table}: {e}")
            continue
        print(f"استيراد {table}...")
        for row in rows:
            if not row:
                continue
            row_id = str(row[0] or "").strip()
            if not row_id:
                continue
            payload = _parse_data(row[1] if len(row) > 1 else {})
            payload["id"] = row_id
            local_store.upsert_row(table, payload)
            count += 1
            if table == "omr_results" and count % 50 == 0:
                print(f"  {table}: {count}")
        stats[table] = count
        print(f"  تم {table}: {count}")
    stats["_seconds"] = round(time.time() - started, 1)
    stats["_status"] = local_store.status()
    return stats


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else r"e:\SchoolBackups\control.backup"
    print("المصدر:", src)
    print("الوجهة:", local_store.data_root())
    out = import_custom_dump(src)
    print(json.dumps({k: v for k, v in out.items() if k != "_status"}, ensure_ascii=False, indent=2))
    print(out.get("_status"))

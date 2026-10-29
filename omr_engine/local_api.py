from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

import local_store

router = APIRouter(prefix="/store", tags=["local-store"])


class RowBody(BaseModel):
    item: Dict[str, Any]


class BulkBody(BaseModel):
    items: List[Dict[str, Any]]
    replace: bool = False


class DeleteIdsBody(BaseModel):
    ids: List[str]


@router.get("/status")
def store_status():
    return local_store.status()


@router.get("/sheets/{row_id}")
def store_sheet(row_id: str):
    path = local_store._sheet_path(row_id)
    if not os_path_isfile(path):
        raise HTTPException(404, "لا توجد صورة لهذه الورقة")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/{table}")
def store_list(table: str, images: int = 0):
    try:
        return local_store.list_rows(table, include_images=bool(images))
    except ValueError:
        raise HTTPException(404, f"unknown table {table}")


@router.get("/{table}/{row_id}")
def store_get(table: str, row_id: str):
    try:
        row = local_store.get_row(table, row_id)
    except ValueError:
        raise HTTPException(404, f"unknown table {table}")
    if not row:
        raise HTTPException(404, "not found")
    return row


@router.put("/{table}/{row_id}")
def store_put(table: str, row_id: str, body: Dict[str, Any]):
    item = dict(body or {})
    item["id"] = row_id
    try:
        return local_store.upsert_row(table, item)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{table}/bulk")
def store_bulk(table: str, body: BulkBody):
    try:
        n = local_store.replace_table(table, body.items) if body.replace else local_store.upsert_many(table, body.items)
        return {"ok": True, "count": n}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{table}/delete-ids")
def store_delete_ids(table: str, body: DeleteIdsBody):
    try:
        return {"ok": True, "count": local_store.delete_ids(table, body.ids)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{table}/{row_id}")
def store_delete(table: str, row_id: str):
    try:
        return {"ok": local_store.delete_row(table, row_id)}
    except ValueError:
        raise HTTPException(404, f"unknown table {table}")


@router.post("/import")
async def store_import(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "ملف فارغ")
    try:
        return local_store.import_payload(raw, file.filename or "")
    except Exception as e:
        raise HTTPException(400, f"تعذّر الاستيراد: {e}")


@router.post("/clear")
def store_clear():
    local_store.clear_all()
    return {"ok": True, **local_store.status()}


def os_path_isfile(path: str) -> bool:
    import os
    return os.path.isfile(path)

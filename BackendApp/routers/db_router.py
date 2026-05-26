import os
import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from config import OLLAMA_BASE_URL
from routers.moderation import _run_moderation
from modules.information_extr import information_extr_ol
from llm.clustering.cluster_positions import clustering_pos_and_args
from modules.summary import summaries

# MongoDB connection
MONGODB_URL     = os.getenv("MONGODB_URL",     "mongodb://mongo_user:mongo_pass@mongodb:27017/ai4d_db?authSource=admin")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai4d_db")
COLLECTION      = "deliberations"

BAMBERG_TOKEN = "sk_e7a6446e489e8fc47492c03afd3025cd08b9985202dd51f8870656c1e6a2ae34a78fa3a762d605d230"
BAMBERG_BASE  = "https://bamberg-gestalten.de"

_mongo_client: AsyncIOMotorClient | None = None

def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(MONGODB_URL)
    return _mongo_client[MONGODB_DB_NAME]


router = APIRouter(prefix="/db", tags=["database"])

# 1. POST /db/populate/{deliberation_id}
@router.post("/populate/{deliberation_id}")
async def populate(deliberation_id: int):
    """
    Fetch comments from the Bamberg API and merge them into the existing DB
    document — preserving moderation & positions for comments that already
    exist, and appending only the new ones.
    """
    url = f"{BAMBERG_BASE}/api/projekt_phases/{deliberation_id}/comments"

    async with httpx.AsyncClient(timeout=30, follow_redirects=True, verify=False) as http:
        resp = await http.get(
            url,
            headers={
                "Authorization": f"Bearer {BAMBERG_TOKEN}",
                "Content-Type":  "application/json",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Bamberg API error: {resp.text}",
        )

    raw_comments: list[dict] = resp.json().get("data", {}).get("comments", [])
    if not raw_comments:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="No comments returned from Bamberg API.",
        )

    db  = get_db()
    doc = await db[COLLECTION].find_one({"deliberation_id": deliberation_id})

    # Build a lookup of existing comments by id so we can preserve their data
    existing: dict[int, dict] = {}
    if doc:
        for c in doc.get("comments", []):
            existing[c["id"]] = c

    merged   = []
    added    = 0
    kept     = 0

    for idx, c in enumerate(raw_comments):
        comment_id   = c.get("id", idx)
        comment_text = c.get("body", "")

        if comment_id in existing:
            # Keep the existing record (moderation + positions intact),
            # but refresh the comment text in case it was edited upstream.
            entry = existing[comment_id]
            entry["comment"] = comment_text
            merged.append(entry)
            kept += 1
        else:
            merged.append({
                "id":         comment_id,
                "comment":    comment_text,
                "moderation": None,
                "positions":  None,
            })
            added += 1

    await db[COLLECTION].update_one(
        {"deliberation_id": deliberation_id},
        {"$set": {
            "comments": merged,
            "deliberation_id": deliberation_id,
        }},
        upsert=True,
    )

    return {
        "status":          "ok",
        "deliberation_id": deliberation_id,
        "total":           len(merged),
        "added":           added,
        "kept":            kept,
    }

# 2. POST /db/moderation/{deliberation_id}
moderation_status: dict[int, str] = {}
@router.post("/moderation/{deliberation_id}")
async def db_moderation(deliberation_id: int, background_tasks: BackgroundTasks, pipeline: str = Form(...)):
    moderation_status[deliberation_id] = "running"
    background_tasks.add_task(_run_moderation_task, deliberation_id, pipeline)
    return {"status": "started"}

async def _run_moderation_task(deliberation_id: int, pipeline: str):
    try:
        db = get_db()
        doc = await db[COLLECTION].find_one({"deliberation_id": deliberation_id})
        comments = doc.get("comments", [])
        from ollama import Client
        client = Client(host=OLLAMA_BASE_URL)
        for comment in comments:
            comment["moderation"] = _run_moderation(pipeline, comment["comment"], client=client)
        await db[COLLECTION].update_one(
            {"deliberation_id": deliberation_id},
            {"$set": {"comments": comments}}
        )
        moderation_status[deliberation_id] = "done"
    except Exception as e:
        moderation_status[deliberation_id] = "error"

@router.get("/moderation/status/{deliberation_id}")
async def moderation_status_endpoint(deliberation_id: int):
    return {"status": moderation_status.get(deliberation_id, "idle")}

# 3. POST /db/extraction/{deliberation_id}
extraction_status: dict[int, str] = {}
@router.post("/extraction/{deliberation_id}")
async def db_extraction(
    deliberation_id: int,
    background_tasks: BackgroundTasks,
    llm: str = Form(...),
):
    extraction_status[deliberation_id] = "running"
    background_tasks.add_task(_run_extraction_task, deliberation_id, llm)
    return {"status": "started"}

async def _run_extraction_task(deliberation_id: int, llm: str):
    try:
        db  = get_db()
        doc = await db[COLLECTION].find_one({"deliberation_id": deliberation_id})
        comments: list[dict] = doc.get("comments", [])
        comment_texts = [c["comment"] for c in comments]

        raw    = information_extr_ol(comment_texts, llm, OLLAMA_BASE_URL)
        result = json.loads(raw)

        positions_list: list[Any] = result.get("positions", [])

        if len(positions_list) > 20:
            from ollama import Client
            client = Client(host=OLLAMA_BASE_URL)
            try:
                result         = clustering_pos_and_args(result, llm, client)
                positions_list = result.get("positions", positions_list)
            except Exception as exc:
                print(f"[db_extraction] clustering failed: {exc}", flush=True)

        if isinstance(positions_list, list) and len(positions_list) == len(comments):
            for i, comment in enumerate(comments):
                comment["positions"] = positions_list[i]
        else:
            for comment in comments:
                comment["positions"] = result

        await db[COLLECTION].update_one(
            {"deliberation_id": deliberation_id},
            {"$set": {"comments": comments}},
        )
        extraction_status[deliberation_id] = "done"
    except Exception as e:
        print(f"[db_extraction] task failed: {e}", flush=True)
        extraction_status[deliberation_id] = "error"

@router.get("/extraction/status/{deliberation_id}")
async def extraction_status_endpoint(deliberation_id: int):
    return {"status": extraction_status.get(deliberation_id, "idle")}

# 4. POST /db/summary/{deliberation_id}
summary_status: dict[int, str] = {}
@router.post("/summary/{deliberation_id}")
async def db_summary(
    deliberation_id: int,
    background_tasks: BackgroundTasks,
    llm:          str = Form(...),
    summary_type: str = Form(default="Report"),
    context_text: str = Form(...),
):
    summary_status[deliberation_id] = "running"
    background_tasks.add_task(_run_summary_task, deliberation_id, llm, summary_type, context_text)
    return {"status": "started"}

async def _run_summary_task(deliberation_id: int, llm: str, summary_type: str, context_text: str):
    try:
        db  = get_db()
        doc = await db[COLLECTION].find_one({"deliberation_id": deliberation_id})
        comments: list[dict] = doc.get("comments", [])
        comment_texts       = [c["comment"] for c in comments]
        extracted_positions = doc.get("extraction", {})

        from ollama import Client
        client = Client(host=OLLAMA_BASE_URL)

        summary_text: str = summaries(
            comment_texts,
            context_text,
            llm,
            OLLAMA_BASE_URL,
            summary_type,
            wp_positions=extracted_positions,
            client=client,
        )

        await db[COLLECTION].update_one(
            {"deliberation_id": deliberation_id},
            {"$set": {"summary": summary_text}},
        )
        summary_status[deliberation_id] = "done"
    except Exception as e:
        print(f"[db_summary] task failed: {e}", flush=True)
        summary_status[deliberation_id] = "error"

@router.get("/summary/status/{deliberation_id}")
async def summary_status_endpoint(deliberation_id: int):
    return {"status": summary_status.get(deliberation_id, "idle")}

# 5. GET /db/deliberation/{deliberation_id}
@router.get("/deliberation/{deliberation_id}")
async def get_deliberation(deliberation_id: int):
    db  = get_db()
    doc = await db[COLLECTION].find_one({"deliberation_id": deliberation_id})
    if not doc:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Deliberation not found.")
    doc.pop("_id", None)
    return doc
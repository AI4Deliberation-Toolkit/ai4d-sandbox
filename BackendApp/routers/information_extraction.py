import json
import httpx
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_500_INTERNAL_SERVER_ERROR

from config import DEFAULT_WHISPER_SIZE, OLLAMA_BASE_URL
from csv_utils import read_csv_upload
from dependencies import require_api_key
from media import media_file_to_text
from modules.information_extr import information_extr_ol, information_extr_single
from llm.clustering.cluster_positions import clustering_pos_and_args

router = APIRouter(tags=["information_extraction"])


#  Sync Endpoints
@router.post("/information_extraction")
async def information_extraction(
        llm: str = Form(...),
        comments_file: Optional[UploadFile] = File(None),
        _api_key: str = Depends(require_api_key),
):
    comments = await read_csv_upload(comments_file)
    if not comments:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="No comments found.")

    return json.loads(information_extr_ol(comments, llm, OLLAMA_BASE_URL))

@router.post("/information_extraction_single_async")
async def information_extraction_single_endpoint(
        background_tasks: BackgroundTasks,
        comments_file: UploadFile = File(...),
        llm: str = Form(...),
        comment_id: int = Form(...),
        post_id: int = Form(...),
        callback_url: str = Form(...),
        callback_token: str = Form(...),
        _api_key: str = Depends(require_api_key),
):
    comments = await read_csv_upload(comments_file)
    if not comments:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="No comments.")

    background_tasks.add_task(
        _extraction_single_callback, 
        comments, llm, comment_id, post_id, callback_url, callback_token
    )
    
    return {"status": "accepted", "comment_id": comment_id}


#  Async / Callback Logic

async def _extraction_single_callback(
        comments: list[dict], llm: str, comment_id: int, post_id: int,
        callback_url: str, callback_token: str
):
    try:
        result_json_str = information_extr_single(comments[0], llm, OLLAMA_BASE_URL)

        payload = {
            "comment_id": comment_id,
            "post_id": post_id,
            "result_json": result_json_str,
            "callback_token": callback_token
        }
    except Exception as exc:
        payload = {"comment_id": comment_id, "post_id": post_id, "error": str(exc), "callback_token": callback_token}

    async with httpx.AsyncClient(timeout=120) as http:
        await http.post(callback_url, json=payload)


@router.post("/information_extraction_consul")
async def information_extr_consul(
        llm: str = Form(...),
        comments: str = Form(...)
):
    print("[consul] endpoint hit", flush=True)

    comments_list = json.loads(comments)
    if not comments_list:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="No comments provided.")

    raw = information_extr_ol(comments_list, llm, OLLAMA_BASE_URL)
    result = json.loads(raw)

    positions_list = result.get("positions", [])
    print(f"[consul] positions count: {len(positions_list)}", flush=True)

    if len(positions_list) > 20:
        from ollama import Client
        client = Client(host=OLLAMA_BASE_URL)
        try:
            return clustering_pos_and_args(result, llm, client)
        except Exception as exc:
            print(f"[consul] clustering failed: {exc}", flush=True)

    return result


# Clustering Async

class AsyncClusterRequest(BaseModel):
    positions: Dict[str, Any]
    llm: str
    post_id: int
    callback_url: str
    callback_token: str


async def _cluster_callback(req: AsyncClusterRequest):
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)
    try:
        result = clustering_pos_and_args(req.positions, req.llm, client)

        if isinstance(result, str):
            result_data = json.loads(result.strip().strip("```json").strip("```"))
        else:
            result_data = result

        payload = {
            "post_id": req.post_id,
            "result_json": json.dumps(result_data, ensure_ascii=False),
            "callback_token": req.callback_token
        }
    except Exception as exc:
        payload = {"post_id": req.post_id, "error": str(exc), "callback_token": req.callback_token}

    async with httpx.AsyncClient(timeout=180) as http:
        await http.post(req.callback_url, json=payload)


@router.post("/cluster_extracted_async")
async def cluster_extracted_async(
        req: AsyncClusterRequest,
        background_tasks: BackgroundTasks,
        _api_key: str = Depends(require_api_key),
):
    background_tasks.add_task(_cluster_callback, req)
    return {"status": "accepted", "post_id": req.post_id}

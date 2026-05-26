"""
Router: /summary  and  /summary_async

``_build_comments_from_request`` is the single place that combines an
optional CSV upload with an optional media file into the comments list
consumed by ``summaries()``.
"""
import io
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN

from config import DEFAULT_WHISPER_SIZE, OLLAMA_BASE_URL, SUMMARY_CALLBACK_SECRET
from csv_utils import read_csv_upload
from dependencies import require_api_key
from media import media_file_to_text
from modules.summary import summaries
from services.wp_comments import get_live_analysis
router = APIRouter(tags=["summary"])

# Helpers
async def _extract_context(
    context_text: Optional[str],
    context_file: Optional[UploadFile],
) -> str:
    """Return the context string from either a plain-text field or a PDF upload."""
    if context_text and context_file:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Provide context as either text or a PDF file, not both.",
        )
    if not context_text and not context_file:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Context is required (either as text or a PDF file).",
        )
    if context_file:
        if context_file.content_type != "application/pdf":
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="Context file must be a PDF.",
            )
        try:
            pdf_bytes = await context_file.read()
            reader = PdfReader(io.BytesIO(pdf_bytes))
            return "\n".join(page.extract_text() for page in reader.pages).strip()
        except Exception as exc:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail=f"Error processing context PDF: {exc}",
            )
    return context_text


async def _build_comments(
    comments_file: Optional[UploadFile],
    media_file: Optional[UploadFile],
    model_size: str,
) -> tuple[list[dict], Optional[str]]:
    """
    Build the comments list and return ``(comments, detected_language)``.

    Combines rows from an optional CSV upload with an optional media
    transcript appended as an extra row.
    """
    if not comments_file and not media_file:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Provide at least a 'comments_file' CSV or a 'media_file'.",
        )

    comments: list[dict] = []
    if comments_file:
        comments = await read_csv_upload(comments_file)

    detected_language: Optional[str] = None
    if media_file:
        result = await media_file_to_text(media_file, model_size)
        detected_language = result["language"]
        if result["transcript"].strip():
            comments.append({
                "source": media_file.filename,
                "detected_language": result["language"],
                "comment": result["transcript"],
            })

    return comments, detected_language

# Synchronous endpoint
@router.post("/summary")
async def summary(
    llm: str = Form(...),
    summary_type: str = Form(...),
    context_text: Optional[str] = Form(None),
    context_file: Optional[UploadFile] = File(None),
    comments_file: Optional[UploadFile] = File(None),
    media_file: Optional[UploadFile] = File(None),
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    _api_key: str = Depends(require_api_key),
):
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)

    context_content = await _extract_context(context_text, context_file)
    comments, detected_language = await _build_comments(comments_file, media_file, model_size)

    response = summaries(comments, context_content, llm, OLLAMA_BASE_URL, summary_type, wp_positions=None, client=client)
    if detected_language:
        response["media_detected_language"] = detected_language
    return response

# Async / callback endpoint
async def _summary_callback(
    llm: str,
    summary_type: str,
    context_text: str,
    csv_content: bytes,
    model_size: str,
    post_id: int,
    callback_url: str,
    callback_token: str,
):
    print(f'---> [TASK START] Processing post_id: {post_id}', flush=True)
    from ollama import Client
    from csv_utils import parse_csv_bytes

    client = Client(host=OLLAMA_BASE_URL)

    try:
        comments = parse_csv_bytes(csv_content)
        print(f'---> [TASK] Running summaries for {len(comments)} comments...', flush=True)
        if not comments:
            raise ValueError("No comments found in CSV.")
        wp_positions = get_live_analysis(post_id, site_url='https://opengovai4d.ellak.gr/', username='admin', app_password='Ylce 3tj9 K5S1 MqGD vHOx X7iO')
        print(f'TEST: {wp_positions}', flush=True)
        result = summaries(comments, context_text, llm, OLLAMA_BASE_URL, summary_type, wp_positions, client=client)
        summary_text = (
            result if isinstance(result, str)
            else result.get("summary") or result.get("result") or str(result)
        )
        if not summary_text.strip():
            raise ValueError("Empty summary returned from LLM.")

        payload = {"post_id": str(post_id), "summary": summary_text, "callback_token": callback_token}
    except Exception as exc:
        payload = {"post_id": str(post_id), "error": str(exc), "callback_token": callback_token}

    async with httpx.AsyncClient(timeout=30) as http:
        try:
            resp = await http.post(callback_url, data=payload)
            print(f"[summary_async] callback {resp.status_code} for post_id={post_id}")
        except Exception as exc:
            print(f"[summary_async] callback FAILED for post_id={post_id}: {exc}")


@router.post("/summary_async")
async def summary_async(
    background_tasks: BackgroundTasks,
    llm: str = Form(...),
    summary_type: str = Form("Report"),
    context_text: str = Form(...),
    comments_file: UploadFile = File(...),
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    post_id: int = Form(...),
    callback_url: str = Form(...),
    callback_token: str = Form(...),
    _api_key: str = Depends(require_api_key),
):
    if callback_token != SUMMARY_CALLBACK_SECRET:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Invalid callback token")

    print('Summary Async')
    csv_content = await comments_file.read()
    background_tasks.add_task(
        _summary_callback,
        llm, summary_type, context_text, csv_content, model_size,
        post_id, callback_url, callback_token,
    )
    return {"status": "accepted", "post_id": post_id}

@router.post("/consul_summary")
async def consul_summary(
        llm: str = Form(...),
        summary_type: str = Form("Report"),
        context_text: str = Form(...),
        comments: list[str] = Form(...),
):
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)
    response = summaries(comments, context_text, llm, OLLAMA_BASE_URL, summary_type, wp_positions=None, client=client)
    return response

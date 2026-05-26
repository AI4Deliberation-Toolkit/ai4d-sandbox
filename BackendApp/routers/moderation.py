"""
Router: /moderation  and  /moderation_async

The core moderation logic lives in ``_run_moderation`` so it is shared
between the synchronous endpoint and the background-task callback.
"""
import os
import tempfile
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN

from config import DEFAULT_WHISPER_SIZE, MODERATION_CALLBACK_SECRET, OLLAMA_BASE_URL
from dependencies import require_api_key
from media import combine_texts, extract_audio, media_file_to_text, transcribe_and_translate
from modules.moderation import moderations, only_llm, without_detoxify
from modules.translation import libreTranslate
from llm.moderation.explanation import result_explanation

import asyncio

router = APIRouter(tags=["moderation"])
ai_task_lock = asyncio.Semaphore(1)

# Shared pipeline logic
def _select_pipeline(pipeline: str, translated_comment: str, client) -> bool:
    """Run the chosen moderation pipeline and return the flagged boolean."""
    if pipeline == "Detoxify -> llama_guard -> LLM":
        return moderations(translated_comment, client=client)
    if pipeline == "llama_guard -> LLM":
        return without_detoxify(translated_comment, client=client)
    return only_llm(translated_comment, client=client)


def _run_moderation(pipeline: str, text: str, client) -> dict:
    """
    Translate *text* to English, run the chosen pipeline, generate an
    explanation, and return the result dict.
    """
    translated = libreTranslate(text)
    flagged = _select_pipeline(pipeline, translated, client)
    explanation = result_explanation(translated, flagged, client=client)
    print(explanation)
    return {
        "is_it_flagged": flagged,
        "moderated_text": translated,
        "explanation": explanation,
    }


# Synchronous endpoint
@router.post("/moderation_consul")
async def moderation_consul(
        pipeline: str = Form(...),
        comments: list[str] = Form(...),
):
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)

    table_results = []
    for comment in comments:
        result = _run_moderation(pipeline, comment, client=client)
        table_results.append(result)
    return table_results


@router.post("/moderation")
async def moderation(
    pipeline: str = Form(...),
    comment: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    _api_key: str = Depends(require_api_key),
):
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)

    transcript_text: Optional[str] = None
    detected_language: Optional[str] = None

    if media_file:
        result = await media_file_to_text(media_file, model_size)
        transcript_text = result["transcript"]
        detected_language = result["language"]

    final_text = combine_texts(transcript_text, comment)

    if not final_text:
        if media_file:
            return {
                "is_it_flagged": False,
                "moderated_text": "No identifiable text for moderation.",
                "detected_language": detected_language or "unknown",
            }
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Provide either 'comment' text or a 'media_file' (or both).",
        )

    response = _run_moderation(pipeline, final_text, client)
    response["detected_language"] = detected_language
    return response


# Async / callback endpoint
async def _fetch_media_from_url(media_url: str) -> tuple[bytes, str]:
    """
    Κατεβάζει αρχείο από URL και επιστρέφει (bytes, filename).
    Χρησιμοποιείται όταν το WordPress στέλνει media_url αντί για binary.
    """
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.get(media_url)
        resp.raise_for_status()
        filename = media_url.split("/")[-1].split("?")[0] or "upload"
        return resp.content, filename


async def _moderation_callback(
    pipeline: str,
    comment: Optional[str],
    media_bytes: Optional[bytes],
    media_filename: Optional[str],
    model_size: str,
    comment_id: int,
    callback_url: str,
    callback_token: str,
):
    """Background task με ουρά αναμονής."""
    from ollama import Client
    client = Client(host=OLLAMA_BASE_URL)

    async with ai_task_lock:
        try:
            detected_language: Optional[str] = None
            transcript_text: Optional[str] = None

            if media_bytes:
                with tempfile.TemporaryDirectory() as tmpdir:
                    suffix = os.path.splitext(media_filename or "upload")[1] or ".webm"
                    input_path = os.path.join(tmpdir, f"input{suffix}")
                    with open(input_path, "wb") as fh:
                        fh.write(media_bytes)

                    audio_path = os.path.join(tmpdir, "audio.wav")
                    extract_audio(input_path, audio_path)

                    result = transcribe_and_translate(audio_path, model_size=model_size)
                    transcript_text = result["transcript"]
                    detected_language = result["language"]

            final_text = combine_texts(transcript_text, comment)
            if not final_text:
                raise ValueError("No text to moderate.")

            moderation_result = _run_moderation(pipeline, final_text, client)

            payload = {
                "comment_id": comment_id,
                "detected_language": detected_language or "",
                "transcript": final_text,
                "callback_token": callback_token,
                **moderation_result,
            }
        except Exception as exc:
            print(f"Error during AI processing: {exc}")
            payload = {
                "comment_id": comment_id,
                "is_it_flagged": False,
                "explanation": f"Moderation error: {exc}",
                "callback_token": callback_token,
            }

    async with httpx.AsyncClient(timeout=120) as http:
        try:
            resp = await http.post(callback_url, data=payload)
            print(f"[moderation_async] callback {resp.status_code} for comment_id={comment_id}")
        except Exception as exc:
            print(f"[moderation_async] callback FAILED: {exc}")


@router.post("/moderation_async")
async def moderation_async(
    background_tasks: BackgroundTasks,
    pipeline: str = Form(...),
    comment: Optional[str] = Form(""),
    media_file: Optional[UploadFile] = File(None),
    media_url: Optional[str] = Form(None),          # ← Νέο: δέχεται URL αν δεν έρθει binary
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    comment_id: int = Form(...),
    callback_url: str = Form(...),
    callback_token: str = Form(...),
    _api_key: str = Depends(require_api_key),
):
    if callback_token != MODERATION_CALLBACK_SECRET:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Invalid callback token")

    print(f"[moderation_async] Received comment_id={comment_id}, has_file={media_file is not None}, has_url={bool(media_url)}")

    media_bytes: Optional[bytes] = None
    media_filename: Optional[str] = None

    if media_file:
        media_bytes = await media_file.read()
        media_filename = media_file.filename
    elif media_url:
        try:
            media_bytes, media_filename = await _fetch_media_from_url(media_url)
            print(f"[moderation_async] Fetched {len(media_bytes)} bytes from {media_url}")
        except Exception as exc:
            print(f"[moderation_async] Failed to fetch media_url: {exc}")

    if not comment and not media_bytes:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Provide either 'comment' text or a 'media_file' / 'media_url' (or both).",
        )

    background_tasks.add_task(
        _moderation_callback,
        pipeline, comment, media_bytes, media_filename,
        model_size, comment_id, callback_url, callback_token,
    )
    return {"status": "accepted", "comment_id": comment_id}
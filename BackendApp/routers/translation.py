from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from starlette.status import HTTP_400_BAD_REQUEST

from config import DEFAULT_WHISPER_SIZE
from dependencies import require_api_key
from media import combine_texts, media_file_to_text
from modules.translation import libreTranslate, ollama_translation

router = APIRouter(tags=["translation"])


@router.post("/translation")
async def translation(
    llm: str = Form(...),
    comment: Optional[str] = Form(None),
    from_language: Optional[str] = Form(None),
    to_language: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    _api_key: str = Depends(require_api_key),
):
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
                "translation": "No translatable text identified in audio/video.",
                "source_text": "No transcript captured.",
                "detected_language": detected_language or "unknown",
            }
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="Provide either 'comment' text or a 'media_file' (or both).",
        )

    from ollama import Client
    from config import OLLAMA_BASE_URL
    client = Client(host=OLLAMA_BASE_URL)

    translated = (
        libreTranslate(final_text)
        if llm == "LibreTranslate"
        else ollama_translation(final_text, from_language, to_language, llm, client=client)
    )

    return {
        "translation": translated,
        "source_text": final_text,
        "detected_language": detected_language,
    }
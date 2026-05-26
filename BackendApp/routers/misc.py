"""
Router: miscellaneous endpoints
  - GET  /get_llms
  - GET  /get_pipelines
  - POST /speech_to_text
  - POST /fact_checking
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from starlette.status import HTTP_400_BAD_REQUEST
from modules.fact_checking import fact_checker
from config import DEFAULT_WHISPER_SIZE, WHISPER_MODEL_SIZES
from dependencies import require_api_key
from media import media_file_to_text, validate_whisper_size
from model_store import store
from pydantic import BaseModel

router = APIRouter(tags=["misc"])


@router.get("/get_llms")
async def get_llms():
    return {
        "llms": [
            "qwen3.6:35b",
            "qwen3.5:35b",
            "LibreTranslate",
            "gemma3:27b",
            "gpt-oss:120b",
            "llama3.1:70b",
            "llama3.1:8b",
            "llama3.3:latest",
            "mistral-small3.2:latest",
            "mistral:instruct",
        ]
    }


@router.get("/get_pipelines")
async def get_pipelines():
    return {"pipelines": ["Detoxify -> llama_guard -> LLM", "llama_guard -> LLM", "LLM"]}

@router.get("/get_summary_pipelines")
async def get_summary_pipelines():
    return {"summary_pipelines": ["Report", "Summary"]}

@router.post("/speech_to_text")
async def speech_to_text(
    media_file: UploadFile = File(...),
    model_size: str = Form(DEFAULT_WHISPER_SIZE),
    _api_key: str = Depends(require_api_key),
):
    validate_whisper_size(model_size)
    result = await media_file_to_text(media_file, model_size)
    return {
        "filename": media_file.filename,
        "detected_language": result["language"],
        "translated_to_english": result["language"] != "en",
        "transcript": result["transcript"],
    }


class FactCheckRequest(BaseModel):
    comment: str

@router.post("/fact_checking")
async def fact_checking(request_data: FactCheckRequest):
    try:
        from modules.fact_checking import fact_checker

        verdict_label, verdict_icon, explanation, confidence, snippets = fact_checker(
            request_data.comment, store.as_dict()
        )

        return {
            "verdict": verdict_label,
            "icon": verdict_icon,
            "confidence": confidence,
            "explanation": explanation,
            "sources": snippets,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
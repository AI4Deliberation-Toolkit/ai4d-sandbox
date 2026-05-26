"""
Media processing helpers: audio extraction, Whisper transcription,
and the high-level UploadFile → text pipeline used by multiple routers.
"""
import os
import tempfile
from typing import Optional

import ffmpeg
import whisper
from fastapi import HTTPException, UploadFile
from starlette.status import HTTP_400_BAD_REQUEST

from config import WHISPER_MODEL_SIZES

# MIME types accepted as media uploads
_ACCEPTED_MEDIA_TYPES: frozenset[str] = frozenset({
    "application/mp4",
    "application/octet-stream",
})


def _is_media_content_type(content_type: str) -> bool:
    return (
        content_type.startswith("audio/")
        or content_type.startswith("video/")
        or content_type in _ACCEPTED_MEDIA_TYPES
    )


def extract_audio(video_path: str, audio_path: str) -> None:
    """Extract audio from *video_path* and write a 16 kHz mono WAV to *audio_path*."""
    (
        ffmpeg
        .input(video_path)
        .output(audio_path, format="wav", acodec="pcm_s16le", ac=1, ar="16000")
        .overwrite_output()
        .run(quiet=True)
    )


def transcribe_and_translate(audio_path: str, model_size: str = "small") -> dict:
    """
    Load a Whisper model, detect the spoken language, transcribe, and
    translate to English when the source is not English.

    Returns:
        ``{"language": str, "transcript": str}``
    """
    model = whisper.load_model(model_size)

    audio = whisper.load_audio(audio_path)
    audio = whisper.pad_or_trim(audio)
    mel = whisper.log_mel_spectrogram(audio).to(model.device)
    _, probs = model.detect_language(mel)
    lang = max(probs, key=probs.get)

    task = "translate" if lang != "en" else "transcribe"
    result = model.transcribe(audio_path, task=task)
    return {"language": lang, "transcript": result["text"].strip()}


async def media_file_to_text(media_file: UploadFile, model_size: str = "small") -> dict:
    """
    End-to-end pipeline: validate → read → extract audio → transcribe.

    Returns:
        ``{"language": str, "transcript": str}``

    Raises:
        ``HTTPException`` (400) on unsupported MIME type or processing failure.
    """
    content_type = media_file.content_type or ""
    if not _is_media_content_type(content_type):
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Unsupported media type '{content_type}'. Accepted: standard audio and video types.",
        )

    file_bytes = await media_file.read()

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            suffix = os.path.splitext(media_file.filename or "upload")[1] or ".mp4"
            input_path = os.path.join(tmpdir, f"input{suffix}")
            with open(input_path, "wb") as fh:
                fh.write(file_bytes)

            audio_path = os.path.join(tmpdir, "audio.wav")
            extract_audio(input_path, audio_path)
            return transcribe_and_translate(audio_path, model_size=model_size)

    except ffmpeg.Error as exc:
        detail = exc.stderr.decode() if exc.stderr else str(exc)
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=f"FFmpeg error: {detail}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=f"Speech-to-text failed: {exc}")


def combine_texts(*texts: Optional[str]) -> Optional[str]:
    """
    Join any number of non-empty strings with a newline separator.
    Returns ``None`` when every argument is empty or whitespace-only.
    """
    parts = [t.strip() for t in texts if t and t.strip()]
    return "\n".join(parts) if parts else None


def validate_whisper_size(model_size: str) -> None:
    """Raise 400 when *model_size* is not a recognised Whisper size."""
    if model_size not in WHISPER_MODEL_SIZES:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Invalid model_size '{model_size}'. Choose from: {', '.join(sorted(WHISPER_MODEL_SIZES))}",
        )
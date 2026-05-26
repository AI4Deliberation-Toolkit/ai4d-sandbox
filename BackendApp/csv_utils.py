import io

import chardet
import pandas as pd
from fastapi import HTTPException, UploadFile
from starlette.status import HTTP_400_BAD_REQUEST


def parse_csv_bytes(content: bytes) -> list[dict]:
    """
    Decode *content* (auto-detected encoding) and parse it as a
    semicolon-delimited CSV.

    Returns a list of row dicts (one per data row).
    Raises ``HTTPException`` (400) on any parsing failure.
    """
    try:
        encoding = chardet.detect(content).get("encoding") or "utf-8"
        decoded = content.decode(encoding)
        df = pd.read_csv(io.StringIO(decoded), delimiter=";", on_bad_lines="skip")
        return df.to_dict(orient="records")
    except Exception as exc:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV: {exc}",
        )


async def read_csv_upload(upload: UploadFile) -> list[dict]:
    """
    Validate that *upload* is a CSV, read it, and return parsed rows.

    Raises ``HTTPException`` (400) when the MIME type is wrong or parsing fails.
    """
    if upload.content_type != "text/csv":
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail="File must be a CSV (text/csv).",
        )
    content = await upload.read()
    return parse_csv_bytes(content)
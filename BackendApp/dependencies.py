from fastapi import Security, HTTPException
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN

from config import API_KEY, API_KEY_NAME

_api_key_header = APIKeyHeader(name=API_KEY_NAME)


async def require_api_key(api_key: str = Security(_api_key_header)) -> str:
    """Validate the request API key; raise 403 on mismatch."""
    if api_key != API_KEY:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Could not validate API key")
    return api_key
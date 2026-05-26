import os

# API authentication
API_KEY: str = os.environ.get("API_KEY", "")
API_KEY_NAME: str = "ai4d"

# Async-callback secrets
MODERATION_CALLBACK_SECRET: str = os.environ.get(
    "MODERATION_CALLBACK_SECRET", ""
)
SUMMARY_CALLBACK_SECRET: str = os.environ.get(
    "SUMMARY_CALLBACK_SECRET", ""
)

# Ollama
OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

# ML model names
T5_MODEL_NAME: str = os.environ.get("T5_MODEL_NAME", "t5-large")
NLI_MODEL_NAME: str = os.environ.get("NLI_MODEL_NAME", "cross-encoder/nli-deberta-v3-small")

# Whisper
WHISPER_MODEL_SIZES: frozenset[str] = frozenset({"tiny", "base", "small", "medium", "large"})
DEFAULT_WHISPER_SIZE: str = "small"

# CORS
CORS_ORIGINS: list[str] = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://34.90.235.233:3000",
    "http://34.90.235.233:8000",
    "http://34.6.143.195:11434/api/generate",
    "http://ai4deliberation-a2:3000",
    "http://ai4deliberation-a2:8000",
    "https://dev-egov-forum.pantheonsite.io/",
    "https://dev-egov-forum.pantheonsite.io",
    "https://dev-ai4d-demo.pantheonsite.io/",
    "https://dev-ai4d-demo.pantheonsite.io",
    "http://localhost:5173/",
    "http://localhost:5173"
]
CORS_ORIGIN_REGEX: str = r"https://.*\.proxy\.runpod\.net"


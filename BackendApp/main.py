from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    T5ForConditionalGeneration,
    T5Tokenizer,
)

from config import CORS_ORIGINS, NLI_MODEL_NAME, T5_MODEL_NAME, CORS_ORIGIN_REGEX
from model_store import store
from routers import information_extraction, misc, moderation, summary, translation
from routers.db_router import router as db_router


# Lifespan: load heavy models once, release on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Loading T5 ({T5_MODEL_NAME})...")
    t5_tokenizer = T5Tokenizer.from_pretrained(T5_MODEL_NAME)
    t5_model = T5ForConditionalGeneration.from_pretrained(T5_MODEL_NAME)
    t5_model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    t5_model = t5_model.to(device)
    print(f"T5 ready (device: {device})")

    print(f"Loading NLI model ({NLI_MODEL_NAME})...")
    nli_tokenizer = AutoTokenizer.from_pretrained(NLI_MODEL_NAME)
    nli_model = AutoModelForSequenceClassification.from_pretrained(NLI_MODEL_NAME)
    nli_model.eval()
    print("NLI model ready")

    store.t5 = t5_model
    store.t5_tokenizer = t5_tokenizer
    store.nli = nli_model
    store.nli_tokenizer = nli_tokenizer
    store.device = device

    print("API ready\n")
    yield

    store.t5 = store.t5_tokenizer = store.nli = store.nli_tokenizer = None
    print("Models released")

# App factory
def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_origin_regex=CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(translation.router)
    app.include_router(moderation.router)
    app.include_router(summary.router)
    app.include_router(information_extraction.router)
    app.include_router(misc.router)
    app.include_router(db_router)

    return app


app = create_app()
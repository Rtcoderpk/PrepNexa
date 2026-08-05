"""pythonai — self-hosted AI microservice (FastAPI).

Responsibilities:
- Faster Whisper transcription + speech metrics (POST /transcribe)
- Sentence-transformer semantic scoring (POST /embeddings)
- Health probe (GET /health)

Runs as its own container/process (PM2), separate from the Next.js app.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routers import embeddings, transcribe
from app.schemas import HealthResponse

app = FastAPI(
    title="InterviewIQ pythonai",
    version="1.0.0",
    description="Self-hosted speech + semantic analysis service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # internal service; network policies restrict egress
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe.router, prefix="/transcribe", tags=["transcribe"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])


@app.get("/health", response_model=HealthResponse)
async def health():
    # Non-blocking: report whether the models are loaded, don't load them on a probe.
    from app.routers import embeddings as emb
    from app.routers import transcribe as tr

    return HealthResponse(
        status="ok",
        whisper_model=config.WHISPER_MODEL_SIZE,
        embedding_model=config.EMBEDDING_MODEL,
        device=config.CT2_DEVICE,
        whisper_loaded=tr.get_model_loaded(),
        embedding_loaded=emb.get_model_loaded(),
    )

"""Request/response models (Pydantic) for the pythonai service."""

from enum import Enum

from pydantic import BaseModel, Field


class TranscriptionSource(str, Enum):
    FASTER_WHISPER = "faster_whisper"
    WEB_SPEECH = "web_speech"


class TranscriptResponse(BaseModel):
    transcript: str = ""
    words_per_minute: float | None = None
    pause_count: int = 0
    avg_pause_sec: float | None = None
    filler_word_count: int = 0
    filler_density: float = 0.0
    fluency_score: float = 0.0
    duration_sec: float | None = None
    source: TranscriptionSource = TranscriptionSource.FASTER_WHISPER


class SemanticScoreRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    answer: str = Field(..., min_length=1, max_length=5000)
    role: str | None = Field(None, max_length=200)
    resume_context: str | None = Field(None, max_length=8000)


class SemanticScoreResponse(BaseModel):
    question: str
    answer: str
    cosine: float = 0.0
    semantic_score: float = 0.0


class HealthResponse(BaseModel):
    status: str = "ok"
    whisper_model: str
    embedding_model: str
    device: str
    whisper_loaded: bool
    embedding_loaded: bool
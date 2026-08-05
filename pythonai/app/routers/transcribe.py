"""Faster Whisper transcription endpoint.

Accepts a WAV upload, transcribes with Faster Whisper (local, no cloud),
computes speech metrics, and returns structured JSON.
"""

import io

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

from app import config
from app.schemas import TranscriptResponse
from app.speech_metrics import count_fillers, filler_density, fluency_score, words_per_minute

router = APIRouter()

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        config.MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _model = WhisperModel(
            config.WHISPER_MODEL_SIZE,
            device=config.CT2_DEVICE,
            compute_type=config.CT2_COMPUTE,
            download_root=str(config.MODEL_CACHE_DIR),
        )
    return _model


def get_model_loaded() -> bool:
    return _model is not None


@router.post("", response_model=TranscriptResponse)
async def transcribe(audio: UploadFile = File(...)):
    if audio.content_type and audio.content_type != "audio/wav":
        raise HTTPException(
            status_code=415,
            detail="Only WAV audio is supported. Convert the recording to WAV first.",
        )

    raw = await audio.read()
    if len(raw) > config.MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large")

    try:
        model = get_model()
        segments, info = model.transcribe(io.BytesIO(raw), language="en", vad_filter=True)
        text = " ".join(seg.text.strip() for seg in segments).strip()
    except Exception as exc:  # noqa: BLE001 - surface upstream decode failures clearly
        raise HTTPException(status_code=422, detail=f"Transcription failed: {exc}") from exc

    duration = float(info.duration) if info else None

    return TranscriptResponse(
        transcript=text,
        words_per_minute=words_per_minute(text, duration) if duration else None,
        pause_count=0,
        avg_pause_sec=None,
        filler_word_count=count_fillers(text),
        filler_density=filler_density(text),
        fluency_score=fluency_score(text),
        duration_sec=duration,
        source="faster_whisper",
    )
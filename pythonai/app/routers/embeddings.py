"""Semantic scoring via local sentence-transformers embeddings.

Cosine similarity alone is insufficient for grading answers, but it anchors the
LLM reasoning pass (see services/semantic-eval.ts). We return both the raw
cosine and a simple normalised score.
"""

from fastapi import APIRouter, HTTPException
from sentence_transformers import SentenceTransformer, util

from app import config
from app.schemas import SemanticScoreRequest, SemanticScoreResponse

router = APIRouter()

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _model


def get_model_loaded() -> bool:
    return _model is not None


@router.post("", response_model=SemanticScoreResponse)
async def semantic_score(req: SemanticScoreRequest):
    try:
        model = get_model()
        question = req.question
        answer = req.answer

        # Embed the question + a distilled "expected answer" signal and compare
        # against the candidate's answer. This catches topic alignment that a
        # naive keyword match would miss.
        reference = f"{question} (role: {req.role or 'any'})"
        emb_ref = model.encode([reference, answer], convert_to_tensor=True)
        cosine = float(util.pytorch_cos_sim(emb_ref[0], emb_ref[1]).item())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}") from exc

    return SemanticScoreResponse(
        question=req.question,
        answer=req.answer,
        cosine=round(cosine, 4),
        semantic_score=round(max(0.0, min(1.0, cosine)), 4),
    )
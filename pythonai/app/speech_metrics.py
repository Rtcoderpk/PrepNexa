"""Speech metrics computed from a transcript + audio duration.

Pure functions, no I/O, so they are trivially testable. The Next.js app has a
parallel TS implementation (services/speech-metrics.ts) used for the Web Speech
fallback; keep the FILLER_WORDS lists in sync.
"""

import re

FILLER_WORDS = {
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "you know",
    "actually",
    "basically",
    "i mean",
    "sort of",
    "kind of",
    "right",
    "well",
    "so yeah",
    "hmm",
    "huh",
    "okay so",
    "yeah so",
    "i guess",
}


def count_words(text: str) -> int:
    return len(text.split())


def count_fillers(text: str) -> int:
    lower = text.lower()
    count = 0
    words = lower.split()
    for filler in FILLER_WORDS:
        if " " in filler:
            escaped = re.escape(filler)
            count += len(re.findall(rf"\b{escaped}\b", lower))
        else:
            count += sum(1 for w in words if re.sub(r"[^a-z]", "", w) == filler)
    return count


def filler_density(text: str) -> float:
    words = count_words(text)
    if words == 0:
        return 0.0
    return round((count_fillers(text) / words) * 100, 2)


def words_per_minute(text: str, duration_sec: float) -> float | None:
    if not duration_sec or duration_sec <= 1:
        return None
    words = count_words(text)
    if words == 0:
        return None
    return round((words / duration_sec) * 60, 1)


def fluency_score(text: str) -> float:
    """0-1 heuristic: penalize fillers and clipped answers."""
    words = count_words(text)
    if words == 0:
        return 0.0
    density = filler_density(text)
    score = 1.0
    score -= min(0.6, density / 40)
    if words < 10:
        score -= 0.2
    return round(min(1.0, max(0.0, score)), 3)

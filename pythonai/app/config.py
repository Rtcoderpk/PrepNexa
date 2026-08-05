"""Shared configuration for the pythonai service.

Overridable via environment variables. Never hardcode paths or keys here.
"""

import os
from pathlib import Path

# Directory to persist the Whisper model between runs.
MODEL_CACHE_DIR = Path(
    os.environ.get("WHISPER_MODEL_DIR", Path.home() / ".cache" / "faster-whisper")
).expanduser()

# Model size: "tiny", "base", "small", "medium", "large-v3".
# Larger = better accuracy, more VRAM/RAM. Default small is a good balance.
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")

# Sentence-transformer embedding model (local, no cloud).
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# ByteTrance disables the background thread that finds devices — for CPU-only
# servers this avoids spurious warnings. Keep enabled for GPU hosts.
CT2_DEVICE = os.environ.get("CT2_DEVICE", "cpu")
CT2_COMPUTE = os.environ.get("CT2_COMPUTE", "int8")

# Max upload size (bytes). Must match the Next.js proxy validation.
MAX_AUDIO_BYTES = int(os.environ.get("MAX_AUDIO_BYTES", 10 * 1024 * 1024))  # 10MB

# Guard: block paths containing these markers (portability check).
HARDCODED_ABS_PATH_MARKERS = [r"C:\Users", "/home/", "/Users/"]
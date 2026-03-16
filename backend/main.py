"""
Naada - Real-time AI Sound Therapy Companion
FastAPI application entry point.

Architecture:
  Browser (Camera + Mic) <-> WebSocket <-> FastAPI <-> ADK Runner <-> Gemini Live API
"""

import os
import sys
import io
import logging
from pathlib import Path

from config import (
    APP_VERSION, HOST, PORT,
    ALLOWED_ORIGINS, GOOGLE_API_KEY,
)

if GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from routes import router as http_router
from websocket_handler import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("naada")

# Suppress noisy tracebacks from Gemini/ADK libraries on clean disconnects.
# These libraries log ConnectionClosedOK (1000) and ConnectionClosedError (1008)
# as ERROR-level tracebacks even though they're normal session teardown events.
class _GeminiDisconnectFilter(logging.Filter):
    """Filters out harmless Gemini/WebSocket disconnect tracebacks."""
    _patterns = [
        "ConnectionClosedOK",
        "ConnectionClosedError",
        "APIError: 1000",
        "sent 1000 (OK)",
        "received 1008",
        "policy violation",
    ]
    def filter(self, record):
        msg = record.getMessage()
        return not any(p in msg for p in self._patterns)

for _lib_logger_name in [
    "google.genai.live",
    "google.genai.errors",
    "google.adk.flows.llm_flows.base_llm_flow",
    "google.adk.models.gemini_llm_connection",
    "websockets",
    "websockets.asyncio.connection",
]:
    logging.getLogger(_lib_logger_name).addFilter(_GeminiDisconnectFilter())

# Also filter stderr — the Gemini/ADK libraries print tracebacks directly to stderr
# before raising exceptions, and Cloud Run treats ALL stderr output as ERROR severity.
class _StderrFilter(io.TextIOWrapper):
    """Wraps stderr to suppress harmless Gemini disconnect tracebacks."""
    _suppress_patterns = [
        "ConnectionClosedOK",
        "ConnectionClosedError",
        "APIError: 1000",
        "sent 1000 (OK)",
        "received 1008",
        "policy violation",
    ]

    def __init__(self, original):
        self._original = original
        self._buffer = ""

    def write(self, text):
        self._buffer += text
        # Flush on newline — check if buffer contains suppressed patterns
        if "\n" in text:
            if not any(p in self._buffer for p in self._suppress_patterns):
                self._original.write(self._buffer)
            self._buffer = ""
        return len(text)

    def flush(self):
        if self._buffer and not any(p in self._buffer for p in self._suppress_patterns):
            self._original.write(self._buffer)
        self._buffer = ""
        self._original.flush()

    def __getattr__(self, name):
        return getattr(self._original, name)

sys.stderr = _StderrFilter(sys.stderr)

app = FastAPI(
    title="Naada",
    description="Real-time AI sound therapy companion with mood detection",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

app.include_router(http_router)
app.include_router(ws_router)

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting Naada server on {HOST}:{PORT}")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True, log_level="info")

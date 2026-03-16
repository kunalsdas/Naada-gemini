"""
Naada - Real-time AI Sound Therapy Companion
FastAPI application entry point.

Architecture:
  Browser (Camera + Mic) <-> WebSocket <-> FastAPI <-> ADK Runner <-> Gemini Live API
"""

import os
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

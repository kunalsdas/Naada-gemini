"""
HTTP Routes
Health check, session creation, and frontend serving.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse

from config import APP_NAME, APP_VERSION

router = APIRouter()

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@router.get("/")
async def serve_frontend():
    """Serve the main frontend HTML."""
    return FileResponse(
        str(FRONTEND_DIR / "index.html"),
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.get("/favicon.ico")
async def serve_favicon():
    """Serve favicon."""
    icon_path = FRONTEND_DIR / "static" / "favicon.ico"
    if icon_path.exists():
        return FileResponse(str(icon_path), media_type="image/x-icon")
    return JSONResponse(status_code=404, content={"detail": "not found"})


@router.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return JSONResponse({
        "status": "healthy",
        "app": APP_NAME,
        "version": APP_VERSION,
    })

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.config import settings
from app.routes import analysis, chat

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("app.main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Professional Legal Agreement Interpretation Assistant",
    version="1.0.0"
)

# Enable CORS for local development (React dev server defaults to port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "openai_configured": bool(settings.OPENAI_API_KEY)
    }

# SPA Frontend Serving:
# Map static assets and route all other queries (HTML5 routing) to React's index.html
static_dist = Path(settings.STATIC_DIR)

if static_dist.exists() and static_dist.is_dir():
    logger.info(f"Serving static frontend files from: {static_dist}")
    
    # Mount assets subdirectory
    assets_dir = static_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static_assets")
    
    # Catch-all to serve index.html for SPA routing
    @app.get("/{catchall:path}")
    async def serve_spa_frontend(catchall: str):
        # Do not capture API routes
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
            
        index_file = static_dist / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return "React Frontend is compiled, but index.html is missing."
else:
    logger.warning(
        f"Static directory not found at: {static_dist}. "
        "Server will run in API-only mode. Compile frontend with 'npm run build' to bundle."
    )
    
    @app.get("/")
    def root():
        return {
            "message": "TnC Bot API is running. Build the frontend to serve the UI from this URL.",
            "documentation": "/docs"
        }

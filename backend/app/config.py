import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "TnC Bot"
    DATABASE_URL: str = "sqlite:////tmp/tnc_bot.db" if os.environ.get("VERCEL") else "sqlite:///./tnc_bot.db"
    
    # Gemini & OpenAI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"
    
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_NAME: str = "gpt-4o"
    OPENAI_DISABLED: bool = False      # Dynamic fallback flag on quota errors
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = Path("/tmp/uploads") if os.environ.get("VERCEL") else Path(__file__).resolve().parent.parent / "uploads"
    STATIC_DIR: Path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    
    # RAG Settings
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# Create directories if they don't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

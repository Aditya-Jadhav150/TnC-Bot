import os
from pathlib import Path
from pydantic_settings import BaseSettings

def is_running_on_vercel() -> bool:
    # Check all common environment variables for Vercel and AWS Lambda runtimes
    if any(k in os.environ for k in ["VERCEL", "VERCEL_ENV", "AWS_LAMBDA_FUNCTION_NAME", "LAMBDA_TASK_ROOT"]):
        return True
    try:
        test_file = Path(".") / "test_write.tmp"
        test_file.touch()
        test_file.unlink()
        return False
    except Exception:
        return True

def get_db_url() -> str:
    if is_running_on_vercel():
        return "sqlite:////tmp/tnc_bot.db"
    return "sqlite:///./tnc_bot.db"

def get_upload_dir() -> Path:
    if is_running_on_vercel():
        return Path("/tmp/uploads")
    local_path = Path(__file__).resolve().parent.parent / "uploads"
    try:
        local_path.mkdir(exist_ok=True)
    except Exception:
        pass
    return local_path

class Settings(BaseSettings):
    PROJECT_NAME: str = "TnC Bot"
    DATABASE_URL: str = get_db_url()
    
    # Gemini & OpenAI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"
    
    # OpenAI Settings
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_NAME: str = "gpt-4o"
    OPENAI_DISABLED: bool = False      # Dynamic fallback flag on quota errors
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = get_upload_dir()
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

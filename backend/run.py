import uvicorn
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env if present
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Check parent directory
    parent_env_path = Path(__file__).resolve().parent.parent / ".env"
    if parent_env_path.exists():
        load_dotenv(dotenv_path=parent_env_path)

if __name__ == "__main__":
    print("Starting TnC Bot Backend Server...")
    print("Ensure you have set your OPENAI_API_KEY in the backend/.env file.")
    print("API Documentation available at: http://localhost:8000/docs")
    print("Frontend UI available at: http://localhost:8000/")
    
    # Run the uvicorn server
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.services.vector_store import search_similarity
from app.services.llm import stream_grounded_chat, explain_clause_in_mode, get_openai_client

router = APIRouter()
logger = logging.getLogger(__name__)

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    document_id: str
    query: str
    history: List[Message] = []

class ExplainRequest(BaseModel):
    clause: str
    mode: str  # "Simple", "Teen-Friendly", "Technical", "Legal"

@router.post("/chat")
async def chat_interaction(request: ChatRequest):
    """
    RAG-grounded chat endpoint. Retrieves similar chunks and streams the GPT response.
    First line yielded is the JSON metadata of retrieved citation chunks.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        openai_client = get_openai_client()
        # 1. Retrieve top-4 relevant chunks using cosine similarity
        relevant_chunks = search_similarity(openai_client, request.document_id, request.query, top_k=4)
        
        # 2. Convert history pydantic models to dicts
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        # 3. Stream chunks metadata first, then the text tokens
        def event_generator():
            try:
                # Yield chunks list as JSON on first line
                metadata = {
                    "chunks": [
                        {
                            "chunk_index": chunk["chunk_index"],
                            "content": chunk["content"]
                        } for chunk in relevant_chunks
                    ]
                }
                yield json.dumps(metadata) + "\n"
                
                # Stream conversational text
                for token in stream_grounded_chat(request.query, history_dicts, relevant_chunks):
                    yield token
            except Exception as e:
                logger.error(f"Error in streaming generation: {e}")
                yield f"\n[Generation Error: {str(e)}]"
                
        return StreamingResponse(event_generator(), media_type="text/plain")
        
    except Exception as e:
        logger.error(f"Chat interaction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/explain")
def explain_clause(request: ExplainRequest):
    """
    Translates a selected clause snippet into the selected explanation style.
    """
    if not request.clause.strip():
        raise HTTPException(status_code=400, detail="Clause text cannot be empty.")
    if request.mode not in ["Simple", "Teen-Friendly", "Technical", "Legal"]:
        raise HTTPException(status_code=400, detail="Invalid explanation style mode.")
        
    try:
        explanation_data = explain_clause_in_mode(request.clause, request.mode)
        return explanation_data
    except Exception as e:
        logger.error(f"Clause translation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

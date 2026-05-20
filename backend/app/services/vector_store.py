import numpy as np
import uuid
import logging
from typing import List, Dict, Any, Tuple
from app.db import save_chunks, get_document_chunks
from app.config import settings

logger = logging.getLogger(__name__)

def split_text_into_chunks(text: str, chunk_size: int = settings.CHUNK_SIZE, overlap: int = settings.CHUNK_OVERLAP) -> List[str]:
    """
    Iteratively splits text into smaller chunks by attempting to break at logical separators
    (paragraphs, sentences, spaces). Avoids recursion to prevent stack overflows.
    """
    if not text:
        return []
        
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        # Determine the maximum search end point for this chunk
        end = min(start + chunk_size, text_len)
        
        # If we have reached the end of the text, consume the remainder
        if end == text_len:
            chunks.append(text[start:end])
            break
            
        # Try to locate a logical separator to split nicely
        found_separator = False
        for sep in ["\n\n", "\n", ". ", " "]:
            idx = text.rfind(sep, start, end)
            # Ensure the separator split makes forward progress (larger than overlap)
            if idx != -1 and idx > start + overlap:
                split_point = idx + len(sep)
                chunks.append(text[start:split_point])
                start = split_point - overlap
                found_separator = True
                break
                
        # If no logical boundary was found within the window, force split at size limit
        if not found_separator:
            chunks.append(text[start:end])
            start = end - overlap
            
    # Filter out empty or very small chunks
    return [c.strip() for c in chunks if len(c.strip()) > 10]


def get_embedding(openai_client, text: str) -> List[float]:
    """
    Generates embedding vector using OpenAI's API.
    Returns a zero vector fallback of the correct dimensions (768 for Gemini, 1536 for OpenAI) if fails.
    """
    # For Gemini, bypass the embeddings API entirely and use fast keyword search
    if settings.GEMINI_API_KEY:
        return [0.0] * 768

    if not settings.OPENAI_API_KEY or settings.OPENAI_DISABLED:
        return [0.0] * 1536

    try:
        response = openai_client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error fetching embedding: {e}")
        # If it's a quota error, trigger dynamic fallback
        if "quota" in str(e).lower() or "429" in str(e):
            logger.warning("Quota exceeded on OpenAI Embeddings. Disabling future API calls.")
            settings.OPENAI_DISABLED = True
        return [0.0] * 1536


def index_document(openai_client, doc_id: str, raw_text: str) -> int:
    """
    Splits, embeds, and saves document chunks to SQLite.
    Returns the number of indexed chunks.
    """
    chunks = split_text_into_chunks(raw_text)
    if not chunks:
        return 0
        
    db_chunks = []
    for idx, chunk_text in enumerate(chunks):
        # Only query API if API key is provided, otherwise save with empty embedding
        api_configured = bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)
        embedding = get_embedding(openai_client, chunk_text) if api_configured else None
        
        db_chunks.append({
            "id": str(uuid.uuid4()),
            "document_id": doc_id,
            "chunk_index": idx,
            "content": chunk_text,
            "embedding": embedding
        })
        
    save_chunks(db_chunks)
    logger.info(f"Indexed document {doc_id} with {len(db_chunks)} chunks.")
    return len(db_chunks)


def keyword_fallback_search(chunks: List[Dict[str, Any]], query: str, top_k: int) -> List[Dict[str, Any]]:
    """
    Performs keyword overlap ranking as a backup if OpenAI embeddings are unavailable.
    """
    query_words = set(query.lower().split())
    scored_chunks = []
    
    for chunk in chunks:
        chunk_words = set(chunk["content"].lower().split())
        # Jaccard index or word overlap count
        overlap = len(query_words.intersection(chunk_words))
        score = overlap / len(query_words.union(chunk_words)) if query_words else 0
        scored_chunks.append((score, chunk))
        
    # Sort by score descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored_chunks[:top_k]]


def search_similarity(openai_client, doc_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """
    Searches the most relevant chunks in a document for a given query.
    Falls back to keyword matching if embeddings are zeroed out (e.g. offline/no API key).
    """
    chunks = get_document_chunks(doc_id)
    if not chunks:
        return []
        
    # Check if we have valid embeddings (non-zero embeddings)
    has_embeddings = False
    if chunks and chunks[0].get("embedding"):
        # Check if the first chunk's embedding vector is not all zeros
        has_embeddings = sum(abs(v) for v in chunks[0]["embedding"]) > 0.0001
        
    # Get query embedding
    query_emb = None
    api_configured = bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)
    if has_embeddings and api_configured:
        query_emb = get_embedding(openai_client, query)
        
    # If we have query embedding and it's non-zero
    if query_emb and sum(abs(v) for v in query_emb) > 0.0001:
        try:
            query_vector = np.array(query_emb)
            scored_chunks = []
            
            for chunk in chunks:
                chunk_vector = np.array(chunk["embedding"])
                
                # Compute cosine similarity: (A . B) / (||A|| * ||B||)
                dot_product = np.dot(query_vector, chunk_vector)
                norm_a = np.linalg.norm(query_vector)
                norm_b = np.linalg.norm(chunk_vector)
                
                similarity = dot_product / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0
                scored_chunks.append((similarity, chunk))
                
            # Sort descending by score
            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            
            # Extract and return top_k
            results = []
            for score, chunk in scored_chunks[:top_k]:
                # Add score metadata
                chunk_copy = chunk.copy()
                chunk_copy["score"] = float(score)
                # Remove raw embedding vector before returning to routes
                if "embedding" in chunk_copy:
                    del chunk_copy["embedding"]
                results.append(chunk_copy)
                
            return results
        except Exception as e:
            logger.error(f"Vector search failed: {e}. Falling back to keyword search...")
            
    # Default fallback
    logger.info("Using keyword search fallback for RAG retrieval.")
    results = keyword_fallback_search(chunks, query, top_k)
    for r in results:
        r["score"] = 0.5  # Neutral indicator score
        if "embedding" in r:
            del r["embedding"]
    return results

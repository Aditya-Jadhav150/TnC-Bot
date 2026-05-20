import hashlib
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.db import (
    save_document, get_document_by_hash, get_document, 
    get_all_documents, update_document_summary, save_version, get_document_versions
)
from app.services.pdf_parser import extract_text_from_pdf_bytes
from app.services.ocr import run_ocr_on_pdf_fallback, run_ocr_on_image
from app.services.vector_store import index_document
from app.services.llm import analyze_agreement_instant, get_openai_client

router = APIRouter()
logger = logging.getLogger(__name__)

class TextAnalysisRequest(BaseModel):
    name: str
    text: str
    category: Optional[str] = "Uncategorized"

def calculate_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def process_and_analyze_text(name: str, text: str, category: str) -> Dict[str, Any]:
    """Helper pipeline to index and run analysis on raw text."""
    content_hash = calculate_sha256(text)
    
    # 1. Check if document already exists (cache / deduplication)
    existing_doc = get_document_by_hash(content_hash)
    if existing_doc:
        logger.info(f"Document already exists. Checking cache status for {name}.")
        import json
        
        summary_obj = existing_doc.get("summary")
        has_error = False
        if summary_obj:
            if isinstance(summary_obj, str):
                try:
                    summary_obj = json.loads(summary_obj)
                except Exception:
                    summary_obj = {}
            if "error" in summary_obj:
                has_error = True
        
        if not existing_doc.get("summary") or has_error:
            logger.info("Cached summary is missing or contains error logs. Re-running analysis.")
            summary_data = analyze_agreement_instant(text)
            update_document_summary(existing_doc["id"], summary_data)
            existing_doc["summary"] = summary_data
        else:
            existing_doc["summary"] = summary_obj
            
        return existing_doc
        
    # 2. Create new document record
    doc_id = str(uuid.uuid4())
    save_document(doc_id, name, text, content_hash, category)
    
    # 3. Create OpenAI client and Index chunks in vector store
    openai_client = get_openai_client()
    index_document(openai_client, doc_id, text)
    
    # 4. Generate structured summary analysis (Quick Understand)
    summary_data = analyze_agreement_instant(text)
    update_document_summary(doc_id, summary_data)
    
    # 5. Save version record
    version_id = str(uuid.uuid4())
    save_version(version_id, doc_id, "Initial Analysis", content_hash, {
        "summary": summary_data.get("summary"),
        "key_clauses_count": len(summary_data.get("key_clauses", []))
    })
    
    # Return document details
    return {
        "id": doc_id,
        "name": name,
        "content": text,
        "hash": content_hash,
        "category": category,
        "summary": summary_data
    }


@router.post("/analyze/text")
def analyze_text(request: TextAnalysisRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty.")
    try:
        return process_and_analyze_text(request.name, request.text, request.category)
    except Exception as e:
        logger.error(f"Text analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/analyze/pdf")
async def analyze_pdf(
    file: UploadFile = File(...),
    category: str = Form("Uncategorized")
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        pdf_bytes = await file.read()
        logger.info(f"Processing uploaded PDF: {file.filename} ({len(pdf_bytes)} bytes)")
        
        # 1. Parse PDF using PyMuPDF
        text, needs_ocr = extract_text_from_pdf_bytes(pdf_bytes)
        
        # 2. Scanned PDF fallback to OCR
        if needs_ocr:
            logger.info("PDF appears to be scanned. Triggering OCR parsing pipeline...")
            text = run_ocr_on_pdf_fallback(pdf_bytes)
            
        if not text.strip() or len(text.strip()) < 10:
            raise HTTPException(
                status_code=422, 
                detail="Unable to extract text from PDF. Ensure the file is not corrupted or empty."
            )
            
        return process_and_analyze_text(file.filename, text, category)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"PDF analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/documents")
def list_documents():
    """Retrieve history of analyzed documents."""
    return get_all_documents()


@router.get("/documents/{doc_id}")
def fetch_document(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    # Parse summary string to dict if needed
    import json
    if doc.get("summary") and isinstance(doc["summary"], str):
        doc["summary"] = json.loads(doc["summary"])
    return doc


@router.get("/documents/{doc_id}/versions")
def fetch_versions(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return get_document_versions(doc_id)

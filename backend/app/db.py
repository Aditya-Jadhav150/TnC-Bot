import sqlite3
import json
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import settings

DB_PATH = settings.DATABASE_URL.replace("sqlite:///", "")
print(f"DEBUG: SQLite Database Path resolved to: {DB_PATH}", flush=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite database tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Documents Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        category TEXT,
        summary TEXT
    )
    """)
    
    # 2. Document Chunks Table (stores text chunks and JSON-serialized embeddings)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )
    """)
    
    # 3. Document Versions Table (for history and change tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_label TEXT NOT NULL,
        hash TEXT NOT NULL,
        analyzed_at TEXT NOT NULL,
        changes_detected TEXT,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Initialize on import
init_db()

# DB Helpers
def save_document(doc_id: str, name: str, content: str, content_hash: str, category: str = "Uncategorized") -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO documents (id, name, content, hash, created_at, updated_at, category) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (doc_id, name, content, content_hash, now, now, category)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Document already exists, let's update updated_at
        cursor.execute(
            "UPDATE documents SET updated_at = ? WHERE hash = ?",
            (now, content_hash)
        )
        conn.commit()
        return False
    finally:
        conn.close()

def get_document_by_hash(content_hash: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE hash = ?", (content_hash,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_all_documents() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, category, created_at, updated_at FROM documents ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_document_summary(doc_id: str, summary_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE documents SET summary = ? WHERE id = ?",
        (json.dumps(summary_data), doc_id)
    )
    conn.commit()
    conn.close()

def save_chunks(chunks: List[Dict[str, Any]]):
    conn = get_db_connection()
    cursor = conn.cursor()
    for chunk in chunks:
        cursor.execute(
            "INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)",
            (chunk["id"], chunk["document_id"], chunk["chunk_index"], chunk["content"], json.dumps(chunk["embedding"]))
        )
    conn.commit()
    conn.close()

def get_document_chunks(doc_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, document_id, chunk_index, content, embedding FROM document_chunks WHERE document_id = ? ORDER BY chunk_index", (doc_id,))
    rows = cursor.fetchall()
    conn.close()
    
    chunks = []
    for r in rows:
        c = dict(r)
        if c["embedding"]:
            c["embedding"] = json.loads(c["embedding"])
        chunks.append(c)
    return chunks

def save_version(version_id: str, doc_id: str, label: str, content_hash: str, changes: Optional[Dict[str, Any]] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()
    changes_json = json.dumps(changes) if changes else None
    cursor.execute(
        "INSERT INTO document_versions (id, document_id, version_label, hash, analyzed_at, changes_detected) VALUES (?, ?, ?, ?, ?, ?)",
        (version_id, doc_id, label, content_hash, now, changes_json)
    )
    conn.commit()
    conn.close()

def get_document_versions(doc_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM document_versions WHERE document_id = ? ORDER BY analyzed_at DESC", (doc_id,))
    rows = cursor.fetchall()
    conn.close()
    
    versions = []
    for r in rows:
        v = dict(r)
        if v["changes_detected"]:
            v["changes_detected"] = json.loads(v["changes_detected"])
        versions.append(v)
    return versions

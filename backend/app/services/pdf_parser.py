import fitz  # PyMuPDF
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> Tuple[str, bool]:
    """
    Extracts text from PDF bytes.
    Returns:
        Tuple[str, bool]: The extracted text, and a boolean indicating if OCR fallback is needed.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        
        if total_pages == 0:
            return "", False
            
        full_text = []
        char_count = 0
        
        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            
            # Use 'blocks' for layout-aware parsing, returning a list of tuples
            # (x0, y0, x1, y1, "text", block_no, block_type)
            blocks = page.get_text("blocks")
            
            # Sort blocks top-to-bottom, then left-to-right
            blocks.sort(key=lambda b: (b[1], b[0]))
            
            page_text = []
            for b in blocks:
                text_block = b[4].strip()
                if not text_block:
                    continue
                
                # Simple filter for boilerplate headers/footers:
                # e.g., page numbers, document titles
                if text_block.isdigit() or (text_block.lower().startswith("page ") and len(text_block) < 15):
                    continue
                
                page_text.append(text_block)
                char_count += len(text_block)
                
            full_text.append(f"\n--- Page {page_num + 1} ---\n" + "\n\n".join(page_text))
            
        final_text = "\n".join(full_text).strip()
        
        # Heuristics: if character count is extremely low for the number of pages,
        # it is likely a scanned image PDF.
        average_chars_per_page = char_count / total_pages if total_pages > 0 else 0
        needs_ocr = average_chars_per_page < 50
        
        logger.info(f"PDF parsed. Pages: {total_pages}, Avg Chars/Page: {average_chars_per_page:.1f}, Scanned: {needs_ocr}")
        return final_text, needs_ocr
        
    except Exception as e:
        logger.error(f"Error reading PDF bytes: {e}")
        return "", True

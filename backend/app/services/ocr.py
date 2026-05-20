import logging
import io
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import PaddleOCR or PyTesseract dynamically
HAS_PADDLE = False
HAS_TESSERACT = False

try:
    from paddleocr import PaddleOCR
    HAS_PADDLE = True
except ImportError:
    pass

try:
    import pytesseract
    from PIL import Image
    HAS_TESSERACT = True
except ImportError:
    pass


def run_ocr_on_image(image_bytes: bytes) -> str:
    """
    Attempts to run OCR on image bytes using available OCR engines.
    """
    global HAS_PADDLE, HAS_TESSERACT
    
    if not image_bytes:
        return ""

    # 1. Try PaddleOCR first (often better layout preservation)
    if HAS_PADDLE:
        try:
            logger.info("Attempting OCR with PaddleOCR...")
            # Initialize paddleocr (eng language)
            ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            result = ocr.ocr(image_bytes, cls=True)
            
            # PaddleOCR returns a list of results per page, containing blocks of [[box, (text, confidence)]]
            text_lines = []
            if result and result[0]:
                for line in result[0]:
                    text_lines.append(line[1][0])
            return "\n".join(text_lines)
        except Exception as e:
            logger.warning(f"PaddleOCR failed: {e}. Falling back to Tesseract...")

    # 2. Try PyTesseract next
    if HAS_TESSERACT:
        try:
            logger.info("Attempting OCR with PyTesseract...")
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            logger.error(f"PyTesseract OCR failed: {e}")
            return (
                "[OCR ERROR: Scanned document/image detected, but OCR engine failed to run. "
                "Please verify that Tesseract-OCR is installed on your system and added to your PATH environment variable.]"
            )

    logger.warning("No OCR library (paddleocr or pytesseract) is installed or available.")
    return (
        "[OCR NOT CONFIGURED: This document appears to be scanned or contains only images. "
        "To enable scanning, please install pytesseract and ensure Tesseract-OCR is installed on your OS, "
        "or install paddleocr.]"
    )


def run_ocr_on_pdf_fallback(pdf_bytes: bytes) -> str:
    """
    Called when a PDF is detected as scanned. If PyMuPDF can render pages to pixmaps, 
    we convert pages to PNG images and run OCR on them.
    """
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        ocr_text_pages = []
        
        # Limit OCR to first 10 pages to prevent huge latencies
        max_ocr_pages = min(len(doc), 10)
        logger.info(f"Running OCR on PDF. Processing first {max_ocr_pages} pages...")
        
        for i in range(max_ocr_pages):
            page = doc.load_page(i)
            # Render page to image (pixmap) at zoom 2.0 for higher OCR quality
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_png = pix.tobytes("png")
            
            page_text = run_ocr_on_image(img_png)
            ocr_text_pages.append(f"\n--- Page {i + 1} (OCR) ---\n{page_text}")
            
        if len(doc) > 10:
            ocr_text_pages.append(f"\n\n--- [Document truncated: Only first 10 pages OCR-processed to ensure rapid response] ---")
            
        return "\n".join(ocr_text_pages)
    except Exception as e:
        logger.error(f"Failed to perform PDF-to-Image rendering for OCR fallback: {e}")
        return "[OCR ERROR: Failed to render scanned PDF pages for text extraction.]"

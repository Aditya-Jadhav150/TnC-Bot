# TnC Bot - Agreement-Intelligence Workspace

TnC Bot is a professional, high-performance web-based workspace designed to help users analyze, interpret, and ask questions about Terms & Conditions, Privacy Policies, EULAs, software licenses, and AI agreements.

The system converts complex legal text into plain English, isolates key clauses, tracks agreement version history, and answers natural questions using a RAG (Retrieval-Augmented Generation) chat engine with exact source citations.

---

## Key Features

1. **Workspace double-pane**: View the original contract text side-by-side with structured interpretations and RAG chat.
2. **Instant "Quick Understand"**: Automatically displays summaries, data permissions, content ownership, AI model training consent, cancellation terms, and retention limits immediately after upload.
3. **Point-and-Explain**: Highlight any clause inside the reader to explain it instantly in one of four styles: *Simple*, *Teen-Friendly*, *Technical*, or *Legal Style*.
4. **Grounded Q&A**: Chat with the agreement. Clicking citations (e.g. `[Block 1]`) scrolls the document viewer to the exact sentence reference.
5. **OCR Fallback**: Extracts text layout-aware from standard PDFs, with automatic image OCR extraction fallback for scanned documents.
6. **No-Setup Local Architecture**: Runs with a unified server using a local SQLite database and in-memory NumPy similarity search (no external DB or Docker required).

---

## Directory Structure

```
a:/MP-ML/
├── backend/            # FastAPI Python Application
│   ├── app/            # Main server routers, db managers, and NLP services
│   ├── .env            # Environment configuration (API Keys)
│   ├── requirements.txt# Python library dependencies
│   └── run.py          # Server execution runner
└── frontend/           # React + TypeScript UI Client
    ├── src/            # Components (Reader, Workspace, Dropzone, Chat)
    ├── package.json    # Node build and development config
    └── tailwind.config.js
```

---

## Installation & Setup

Ensure you have **Python 3.8+** and **Node.js 18+** installed.

### 1. Setup Backend Environment

Open a terminal at the root of the project and run:

```bash
# Navigate to backend folder
cd backend

# Create a virtual environment (optional but recommended)
python -m venv venv
# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Open `backend/.env` and paste your OpenAI API Key:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL_NAME=gpt-4o
DATABASE_URL=sqlite:///./tnc_bot.db
```

### 3. Setup and Compile Frontend

To bundle the frontend so that the backend can serve it natively, compile the assets:

```bash
# Navigate to frontend folder (from root)
cd ../frontend

# Install dependencies
npm install

# Compile production bundle
npm run build
```

This creates a `dist` static folder under `frontend/` which the FastAPI backend is pre-configured to host.

---

## Running the Application

Once the frontend is compiled and the backend virtual environment is active, start the unified server:

```bash
# Navigate to backend folder
cd ../backend

# Run the unified server script
python run.py
```

### Accessing the Workspace:
- Open your browser to **[http://localhost:8000/](http://localhost:8000/)** to launch the full workspace UI.
- Open **[http://localhost:8000/docs](http://localhost:8000/docs)** to view the interactive FastAPI documentation.

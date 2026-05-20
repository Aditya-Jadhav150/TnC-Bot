import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface DocumentDropzoneProps {
  onAnalyzeText: (name: string, text: string, category: string) => Promise<void>;
  onAnalyzePdf: (file: File, category: string) => Promise<void>;
  isLoading: boolean;
}

export const DocumentDropzone: React.FC<DocumentDropzoneProps> = ({
  onAnalyzeText,
  onAnalyzePdf,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [category, setCategory] = useState<string>('Terms of Service');
  const [pastedText, setPastedText] = useState<string>('');
  const [docName, setDocName] = useState<string>('');
  
  // File Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    'Terms of Service',
    'Privacy Policy',
    'EULA',
    'Software License',
    'AI Agreement',
    'SaaS Agreement',
    'Consent Form'
  ];

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setError(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
      } else {
        setError("Only PDF files are supported. For images or raw text, paste them in the Paste Text tab.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pastedText.trim()) {
      setError("Please paste contract text first.");
      return;
    }
    const name = docName.trim() || `Pasted Agreement (${category})`;
    try {
      await onAnalyzeText(name, pastedText, category);
    } catch (err: any) {
      setError(err?.message || "Failed to process text. Check API configuration.");
    }
  };

  const handleUploadSubmit = async () => {
    setError(null);
    if (!selectedFile) {
      setError("Please select or drop a PDF file first.");
      return;
    }
    try {
      await onAnalyzePdf(selectedFile, category);
    } catch (err: any) {
      setError(err?.message || "Failed to parse PDF. Scanned files require local OCR configurations.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-12 animate-fade-in px-4">
      {/* Introduction Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-8 text-center shadow-soft-md">
        <h2 className="text-3xl font-bold text-slate-100 tracking-tight font-display mb-3">
          Understand agreements instantly.
        </h2>
        <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
          Upload any legal contract, terms of service, or privacy policy. TnC Bot parses, structures, and simplifies the clauses into plain English using advanced document retrieval and GPT analysis.
        </p>
      </div>

      {/* Workspace Upload Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-soft-lg overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40">
          <button
            onClick={() => { setActiveTab('upload'); setError(null); }}
            className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-brand-500 text-brand-400 bg-slate-900/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            disabled={isLoading}
          >
            Upload PDF Document
          </button>
          <button
            onClick={() => { setActiveTab('paste'); setError(null); }}
            className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'paste'
                ? 'border-brand-500 text-brand-400 bg-slate-900/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            disabled={isLoading}
          >
            Paste Raw Text
          </button>
        </div>

        {/* Input Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-950/30 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form settings */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Agreement Category
            </label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    category === cat
                      ? 'bg-brand-500/10 border-brand-500/50 text-brand-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'upload' ? (
            /* PDF File Uploader */
            <div className="space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-brand-500 bg-brand-950/10'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/20'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                  disabled={isLoading}
                />
                
                {selectedFile ? (
                  <div className="flex flex-col items-center text-center">
                    <FileText className="w-12 h-12 text-brand-400 mb-3" />
                    <span className="text-sm font-semibold text-slate-200">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-xs text-red-400 hover:underline mt-2"
                      disabled={isLoading}
                    >
                      Clear Selection
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <UploadCloud className="w-12 h-12 text-slate-500 mb-3" />
                    <p className="text-sm font-semibold text-slate-300">
                      Drag and drop your PDF agreement here
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Or click to browse files from your computer
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleUploadSubmit}
                disabled={isLoading || !selectedFile}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Analyzing PDF Layout & Extracts...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Document</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Paste Raw Text Form */
            <form onSubmit={handlePasteSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Document Name / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., OpenAI Terms of Use (May 2026)"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Paste Agreement Content
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste the full text of the agreement or clauses here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 resize-y font-mono"
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !pastedText.trim()}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Analyzing Text & Indexing Chunks...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Agreement Text</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Loading Overlay Details */}
        {isLoading && (
          <div className="border-t border-slate-800 bg-slate-900/20 px-8 py-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex gap-1.5 items-center">
              <CheckCircle2 className="w-4 h-4 text-brand-400 animate-pulse" />
              <span>Splitting into logical RAG chunks</span>
            </div>
            <span>•</span>
            <div className="flex gap-1.5 items-center">
              <CheckCircle2 className="w-4 h-4 text-brand-400 animate-pulse" />
              <span>Extracting legal summaries & permission tokens</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, MessageSquare, Maximize2, Send, Terminal } from 'lucide-react';

interface Citation {
  chunk_index: number;
  content: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface KeyClause {
  topic: string;
  clause_title: string;
  original_snippet: string;
  plain_english: string;
  status: 'clear' | 'ambiguous';
}

interface SummaryData {
  summary: string;
  category: string;
  ai_training: string;
  permissions: string;
  ownership: string;
  termination: string;
  retention: string;
  key_clauses: KeyClause[];
}

interface ScannedDocument {
  id: string;
  name: string;
  content: string;
  category?: string;
  summary?: SummaryData;
}

interface FloatingAssistantProps {
  activeDoc: ScannedDocument | null;
  onOpenFullWorkspace: (docId: string) => void;
  onRefreshHistory: () => Promise<void>;
}

// Sample mock webpage content for simulated scans when no doc is loaded
const SIMULATED_WEBPAGE_NAME = "Google Workspace Terms of Service (Simulated Current Tab)";
const SIMULATED_WEBPAGE_CONTENT = `
Google Workspace Terms of Service
Last modified: January 15, 2026

Customer Data and Ownership
Customer retains all intellectual property rights in Customer Data. Google does not acquire any ownership rights in Customer Data except for the limited rights needed to provide the services. 

AI and Machine Learning Model Training
Google will not use Customer Data (including prompts, files, or generated outputs) to train or improve its generative AI models, machine learning algorithms, or system intelligence without Customer's explicit opt-in consent. Google may process Customer Data for safety and abuse prevention audits.

Account Termination
Customer may terminate this Agreement at any time by cancelling their subscription. Google reserves the right to suspend or terminate services immediately if Customer materially breaches these Terms, or if Google ceases providing the Workspace services. Subscription fees are non-refundable.

Data Retention and Deletion
Google stores Customer Data for the duration of the subscription. Upon deletion request or subscription termination, Google will delete Customer Data from its active systems within 30 days, and from all backup systems within 180 days.
`;

export const FloatingAssistant: React.FC<FloatingAssistantProps> = ({
  activeDoc,
  onOpenFullWorkspace,
  onRefreshHistory
}) => {
  const [isClosed, setIsClosed] = useState<boolean>(() => {
    return localStorage.getItem('floating-assistant-closed') === 'true';
  });

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('floating-assistant-position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    // Default to bottom right
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isIdle, setIsIdle] = useState<boolean>(false);
  
  // Scanned Document State
  const [scannedDoc, setScannedDoc] = useState<ScannedDocument | null>(() => {
    const saved = localStorage.getItem('floating-assistant-last-scan');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  // Mini-Chat State
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [overlayTab, setOverlayTab] = useState<'summary' | 'ai' | 'chat'>('summary');

  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const idleTimer = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Synchronize close state with localStorage
  useEffect(() => {
    localStorage.setItem('floating-assistant-closed', String(isClosed));
    // Expose a global event so the parent Header can toggle this
    const handleReopen = () => setIsClosed(false);
    window.addEventListener('reopen-floating-assistant', handleReopen);
    return () => window.removeEventListener('reopen-floating-assistant', handleReopen);
  }, [isClosed]);

  // Adjust position if window is resized
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const x = Math.min(prev.x, window.innerWidth - 64);
        const y = Math.min(prev.y, window.innerHeight - 64);
        return { x, y };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Idle fade out timer (3 seconds)
  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!isHovered && !isOpen && !isMenuOpen && !isScanning) {
        setIsIdle(true);
      }
    }, 3000);
  };

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isHovered, isOpen, isMenuOpen, isScanning]);

  // Scroll mini-chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoadingChat]);

  if (isClosed) return null;

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isScanning) return;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setIsDragging(true);
    resetIdleTimer();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(16, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 64));
    const newY = Math.max(16, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 64));
    setPosition({ x: newX, y: newY });
    resetIdleTimer();
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Snap to nearest vertical edge (left or right)
    const buttonWidth = buttonRef.current?.offsetWidth || 56;
    const halfWidth = window.innerWidth / 2;
    let finalX = 16; // left edge
    if (position.x + buttonWidth / 2 > halfWidth) {
      finalX = window.innerWidth - buttonWidth - 16; // right edge
    }

    const finalPos = { x: finalX, y: position.y };
    setPosition(finalPos);
    localStorage.setItem('floating-assistant-position', JSON.stringify(finalPos));
    resetIdleTimer();
  };

  // Bind mouse move and mouse up globally so dragging doesn't break when sliding off the button
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  // Click Handler (Distinguish between click and drag)
  const handleButtonClick = () => {
    // If the click is on close action or we were dragging, ignore
    if (isDragging) return;
    setIsMenuOpen((prev) => !prev);
    setIsOpen(false); // Close overlay panel when clicking menu
  };

  // Perform Scan Action
  const handleScanAction = async () => {
    setIsMenuOpen(false);
    setIsScanning(true);
    
    // Choose document text to analyze
    let textToAnalyze = SIMULATED_WEBPAGE_CONTENT;
    let nameToAnalyze = SIMULATED_WEBPAGE_NAME;
    let categoryToAnalyze = "AI Agreement";

    if (activeDoc) {
      textToAnalyze = activeDoc.content;
      nameToAnalyze = activeDoc.name;
      categoryToAnalyze = activeDoc.category || "AI Agreement";
    }

    try {
      const response = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameToAnalyze,
          text: textToAnalyze,
          category: categoryToAnalyze
        })
      });

      if (response.ok) {
        const data = await response.json();
        setScannedDoc(data);
        localStorage.setItem('floating-assistant-last-scan', JSON.stringify(data));
        setChatMessages([]); // Reset chat history for new scan
        setIsOpen(true); // Open the compact panel
        setOverlayTab('summary');
        await onRefreshHistory(); // Refresh sidebar history list
      }
    } catch (e) {
      console.error("Floating Assistant Scan Failed: ", e);
    } finally {
      setIsScanning(false);
    }
  };

  // Exit Action
  const handleExitAction = () => {
    setIsMenuOpen(false);
    setIsOpen(false);
    setIsClosed(true);
  };

  // Chat Q&A Submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !scannedDoc || isLoadingChat) return;

    const userText = chatInput.trim();
    const userMsg: Message = { role: 'user', content: userText };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsLoadingChat(true);

    const historyPayload = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const assistantMsgIndex = chatMessages.length + 1;
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '', citations: [] }]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: scannedDoc.id,
          query: userText,
          history: [...historyPayload, { role: 'user', content: userText }]
        })
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstLine = true;
      let citations: Citation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');

        if (isFirstLine && lines.length > 1) {
          const firstLine = lines.shift() || '';
          buffer = lines.join('\n');
          isFirstLine = false;
          try {
            const meta = JSON.parse(firstLine);
            if (meta && meta.chunks) {
              citations = meta.chunks;
            }
          } catch (e) {
            buffer = firstLine + '\n' + buffer;
          }
        }

        setChatMessages((prev) => {
          const next = [...prev];
          if (next[assistantMsgIndex]) {
            next[assistantMsgIndex] = {
              role: 'assistant',
              content: buffer,
              citations
            };
          }
          return next;
        });
      }
    } catch (e: any) {
      setChatMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx] && next[lastIdx].role === 'assistant') {
          next[lastIdx].content = `Failed to get response: ${e.message}`;
        }
        return next;
      });
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    if (isLoadingChat) return;
    setChatInput(text);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      
      {/* 1. FLOATING ACTION BUTTON */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onClick={handleButtonClick}
        onMouseEnter={() => { setIsHovered(true); setIsIdle(false); }}
        onMouseLeave={() => { setIsHovered(false); resetIdleTimer(); }}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`absolute w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing border shadow-lg transition-all focus:outline-none select-none z-50 ${
          isScanning 
            ? 'bg-slate-900 border-indigo-500/80 text-indigo-400' 
            : isMenuOpen || isOpen 
              ? 'bg-brand-600 border-brand-500 text-white scale-95' 
              : 'bg-slate-900/90 border-slate-800 text-brand-400 hover:border-brand-500/50 hover:text-brand-300 hover:scale-105'
        } ${isIdle ? 'opacity-50' : 'opacity-100'}`}
        title="TnC Bot Assistant"
      >
        {isScanning ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
            <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
          </div>
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
      </button>

      {/* 2. CONTEXTUAL POPUP MENU */}
      {isMenuOpen && (
        <div
          style={{
            left: `${position.x + (position.x > window.innerWidth / 2 ? -130 : 64)}px`,
            top: `${position.y - 48}px`,
          }}
          className="absolute bg-slate-900/95 backdrop-blur-md border border-slate-800 p-1.5 rounded-lg shadow-xl pointer-events-auto flex flex-col gap-1 w-32 animate-in fade-in zoom-in-95 duration-100 z-50"
        >
          <button
            onClick={handleScanAction}
            className="w-full text-left px-2.5 py-1.5 rounded text-[11px] font-semibold text-slate-300 hover:text-brand-400 hover:bg-slate-850 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Scan Page</span>
          </button>
          <button
            onClick={handleExitAction}
            className="w-full text-left px-2.5 py-1.5 rounded text-[11px] font-semibold text-red-400 hover:text-red-300 hover:bg-slate-850 transition-all flex items-center gap-2 cursor-pointer border-t border-slate-850/50 mt-0.5 pt-1.5"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
            <span>Exit Bot</span>
          </button>
        </div>
      )}

      {/* 3. COMPACT ANALYSIS OVERLAY PANEL */}
      {isOpen && scannedDoc && (
        <div className="absolute right-4 bottom-20 top-4 w-[380px] bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-soft-2xl pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 z-40">
          
          {/* Panel Header */}
          <div className="px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[9px] uppercase tracking-wider font-bold text-brand-400">TnC Quick Scan</span>
              <h3 className="text-xs font-bold text-slate-200 truncate" title={scannedDoc.name}>
                {scannedDoc.name}
              </h3>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onOpenFullWorkspace(scannedDoc.id)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-brand-400 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                title="Open Full Workspace"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                title="Close Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Tabs */}
          <div className="px-4 py-2 border-b border-slate-800/50 flex gap-1.5 shrink-0 bg-slate-900/10">
            <button
              onClick={() => setOverlayTab('summary')}
              className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-center transition-all ${
                overlayTab === 'summary'
                  ? 'bg-brand-600/90 text-white border border-brand-500/50'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setOverlayTab('ai')}
              className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-center transition-all ${
                overlayTab === 'ai'
                  ? 'bg-brand-600/90 text-white border border-brand-500/50'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              AI & Rights
            </button>
            <button
              onClick={() => setOverlayTab('chat')}
              className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-center transition-all ${
                overlayTab === 'chat'
                  ? 'bg-brand-600/90 text-white border border-brand-500/50'
                  : 'bg-slate-900/50 text-slate-400 border border-slate-850 hover:text-slate-200'
              }`}
            >
              Ask Bot
            </button>
          </div>

          {/* Scrollable Overlay Content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
            
            {/* TAB 1: SUMMARY */}
            {overlayTab === 'summary' && scannedDoc.summary && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Executive summary block */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 space-y-2">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-brand-400">Executive Summary</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {scannedDoc.summary.summary}
                  </p>
                </div>

                {/* Important Clauses list */}
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Key Scanned Clauses</h4>
                  <div className="space-y-2.5">
                    {scannedDoc.summary.key_clauses.slice(0, 4).map((cl, cIdx) => (
                      <div key={cIdx} className="bg-slate-900/30 border border-slate-850 rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-200">{cl.clause_title}</span>
                          <span className={`text-[8px] uppercase font-mono px-1 py-0.5 rounded border ${
                            cl.status === 'clear' 
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' 
                              : 'bg-amber-950/40 text-amber-400 border-amber-900/30'
                          }`}>
                            {cl.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {cl.plain_english}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI & RIGHTS */}
            {overlayTab === 'ai' && scannedDoc.summary && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* AI training rights */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">AI Model Training</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scannedDoc.summary.ai_training}
                  </p>
                </div>

                {/* Data Ownership */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Content Ownership</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scannedDoc.summary.ownership}
                  </p>
                </div>

                {/* Account Cancellation */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Account Cancellation</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scannedDoc.summary.termination}
                  </p>
                </div>

                {/* Retention and Privacy highlights */}
                <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-rose-400">Retention & Privacy</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scannedDoc.summary.retention}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: ASK BOT */}
            {overlayTab === 'chat' && (
              <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-150">
                
                {/* Chat Log Logs */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px]">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2">
                      <MessageSquare className="w-6 h-6 text-slate-600" />
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-slate-400 block">Grounded Quick Q&A</span>
                        <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
                          Ask anything about model training, refunds, arbitration, or liability.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-0.5`}>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">
                          {msg.role === 'user' ? 'You' : 'TnC Bot'}
                        </span>
                        <div className={`px-3 py-2 text-[11px] leading-relaxed rounded-xl max-w-[90%] ${
                          msg.role === 'user'
                            ? 'bg-brand-600 text-white rounded-br-none'
                            : 'bg-slate-900 border border-slate-850 text-slate-300 rounded-bl-none'
                        }`}>
                          <div className="whitespace-pre-line">{msg.content}</div>
                          {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center gap-1 text-[8px] text-slate-500 font-bold uppercase">
                              <Terminal className="w-2.5 h-2.5 text-slate-500" />
                              <span>Grounded response</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isLoadingChat && (
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">TnC Bot</span>
                      <div className="px-3 py-2 text-[11px] rounded-xl bg-slate-900 border border-slate-850 text-slate-400 rounded-bl-none italic flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Suggestions Quick Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => handleSuggestionClick("Can they use my data for AI training?")}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-850 rounded-lg text-[9px] text-slate-300 font-medium cursor-pointer"
                  >
                    AI Training?
                  </button>
                  <button
                    onClick={() => handleSuggestionClick("Can they terminate my account?")}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-850 rounded-lg text-[9px] text-slate-300 font-medium cursor-pointer"
                  >
                    Account Closure?
                  </button>
                  <button
                    onClick={() => handleSuggestionClick("Who owns uploaded content?")}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-850 rounded-lg text-[9px] text-slate-300 font-medium cursor-pointer"
                  >
                    Data Ownership?
                  </button>
                </div>

                {/* Mini Input Box */}
                <form onSubmit={handleChatSubmit} className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Ask assistant..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isLoadingChat}
                    className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                  />
                  <button
                    type="submit"
                    disabled={isLoadingChat || !chatInput.trim()}
                    className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 p-2 rounded-lg text-white transition-all shadow flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

          </div>

          {/* Panel Footer */}
          <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/30 text-center shrink-0">
            <button
              onClick={() => onOpenFullWorkspace(scannedDoc.id)}
              className="text-[10px] font-bold text-brand-400 hover:text-brand-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto uppercase tracking-wider py-1.5 w-full"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Open Full Workspace</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};

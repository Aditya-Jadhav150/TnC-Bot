import { useState, useEffect } from 'react';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { DocumentDropzone } from './components/DocumentDropzone';
import { QuickUnderstand } from './components/QuickUnderstand';
import { DocumentViewer } from './components/DocumentViewer';
import { GroundedChat } from './components/GroundedChat';
import { HelpCircle, Sparkles, FolderOpen } from 'lucide-react';
import { FloatingAssistant } from './components/FloatingAssistant';
import { API_BASE } from './config';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface OverlayPluginType {
  toggleOverlay(options: { enable: boolean }): Promise<{ status: string }>;
}

const OverlayPlugin = registerPlugin<OverlayPluginType>('OverlayPlugin');

// Custom in-app console logging interception system
interface DebugLog {
  type: 'log' | 'warn' | 'error';
  text: string;
  time: string;
}

const capturedLogs: DebugLog[] = [];
const logListeners: Array<() => void> = [];

const addDebugLog = (type: 'log' | 'warn' | 'error', text: string) => {
  capturedLogs.push({ type, text, time: new Date().toLocaleTimeString() });
  if (capturedLogs.length > 250) {
    capturedLogs.shift();
  }
  logListeners.forEach(listener => listener());
};

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: any[]) => {
  originalLog.apply(console, args);
  addDebugLog('log', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
};

console.warn = (...args: any[]) => {
  originalWarn.apply(console, args);
  addDebugLog('warn', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
};

console.error = (...args: any[]) => {
  originalError.apply(console, args);
  addDebugLog('error', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
};

// Global unhandled error handlers
window.addEventListener('error', (event) => {
  const errMsg = `${event.message} at ${event.filename}:${event.lineno}`;
  addDebugLog('error', `Global Exception: ${errMsg}`);
  alert(`JS Global Error:\n${errMsg}`);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  addDebugLog('error', `Unhandled Promise Rejection: ${reason}`);
  alert(`Promise Rejection:\n${reason}`);
});


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

interface Document {
  id: string;
  name: string;
  content: string;
  category?: string;
  hash: string;
  summary?: SummaryData;
  created_at?: string;
  updated_at?: string;
}

interface Version {
  id: string;
  version_label: string;
  hash: string;
  analyzed_at: string;
  changes_detected?: any;
}

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  
  // Show Bot toggle state
  const [showBot, setShowBot] = useState<boolean>(false);

  // Debug Console States
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);

  useEffect(() => {
    // Synchronize initial logs
    setLogs([...capturedLogs]);
    const handleLogUpdate = () => {
      setLogs([...capturedLogs]);
    };
    logListeners.push(handleLogUpdate);
    return () => {
      const idx = logListeners.indexOf(handleLogUpdate);
      if (idx > -1) logListeners.splice(idx, 1);
    };
  }, []);

  // Responsive layout state
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState<'reader' | 'summary' | 'chat'>('reader');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Synchronize showBot with native Android overlay
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      console.log("Sending toggleOverlay command. Enable value: " + showBot);
      OverlayPlugin.toggleOverlay({ enable: showBot })
        .then((res) => {
          console.log("toggleOverlay resolved successfully. Status: " + (res ? res.status : "unknown"));
          if (res && res.status === 'permission_required') {
            console.warn("Overlay permission is required. Resetting toggle.");
            setShowBot(false);
          }
        })
        .catch((err) => {
          console.error("Failed to toggle native overlay: ", err);
          alert("Failed to toggle native overlay!\nError: " + (err.message || JSON.stringify(err)));
          setShowBot(false);
        });
    }
  }, [showBot]);


  // App view modes
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'dashboard' | 'chat'>('dashboard');

  // Interactive highlight state
  const [highlightSnippet, setHighlightSnippet] = useState<string | null>(null);

  // Chat message logs
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);

  // Load history list on startup
  useEffect(() => {
    fetchDocumentsHistory();
  }, []);

  const fetchDocumentsHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Failed to load document history: ", e);
    }
  };

  const handleSelectDocument = async (id: string) => {
    setIsLoadingAnalysis(true);
    setHighlightSnippet(null);
    setChatMessages([]);
    setRightPanelTab('dashboard');
    try {
      const response = await fetch(`${API_BASE}/api/documents/${id}`);
      if (response.ok) {
        const doc = await response.json();
        setActiveDoc(doc);
        setSelectedDocId(doc.id);
        setIsUploading(false);
        
        // Fetch versions history
        const vResponse = await fetch(`${API_BASE}/api/documents/${id}/versions`);
        if (vResponse.ok) {
          const vData = await vResponse.json();
          setVersions(vData);
        }
      }
    } catch (e) {
      console.error("Failed to load document details: ", e);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleAnalyzeText = async (name: string, text: string, category: string) => {
    setIsLoadingAnalysis(true);
    try {
      const response = await fetch(`${API_BASE}/api/analyze/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, text, category }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to analyze raw text.");
      }

      const newDoc = await response.json();
      setActiveDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setIsUploading(false);
      
      // Refresh sidebar history list
      await fetchDocumentsHistory();
      
      // Set versions
      setVersions([{
        id: 'initial',
        version_label: 'Initial Analysis',
        hash: newDoc.hash,
        analyzed_at: new Date().toISOString()
      }]);
      
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleAnalyzePdf = async (file: File, category: string) => {
    setIsLoadingAnalysis(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await fetch(`${API_BASE}/api/analyze/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to analyze PDF file.");
      }

      const newDoc = await response.json();
      setActiveDoc(newDoc);
      setSelectedDocId(newDoc.id);
      setIsUploading(false);
      
      await fetchDocumentsHistory();
      
      // Fetch versions
      const vResponse = await fetch(`${API_BASE}/api/documents/${newDoc.id}/versions`);
      if (vResponse.ok) {
        const vData = await vResponse.json();
        setVersions(vData);
      }
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleSendMessage = async (queryText: string) => {
    if (!activeDoc || isLoadingChat) return;

    const userMsg: Message = { role: 'user', content: queryText };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsLoadingChat(true);

    // Prepare history payload for RAG endpoint
    const historyPayload = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Append placeholders for streaming assistant message
      const assistantMsgIndex = chatMessages.length + 1;
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '', citations: [] }]);

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: activeDoc.id,
          query: queryText,
          history: [...historyPayload, { role: 'user', content: queryText }]
        }),
      });

      if (!response.ok) {
        throw new Error("Chat service failed to connect.");
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstLine = true;
      let streamedCitations: Citation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Split by lines to inspect citation JSON on first line
        let lines = buffer.split('\n');
        
        if (isFirstLine && lines.length > 1) {
          const firstLine = lines.shift() || '';
          buffer = lines.join('\n'); // keep remaining
          isFirstLine = false;
          
          try {
            const meta = JSON.parse(firstLine);
            if (meta && meta.chunks) {
              streamedCitations = meta.chunks;
            }
          } catch (err) {
            console.warn("Failed to parse first line chunk metadata: ", err);
            // If it wasn't valid JSON, treat it as normal text token
            buffer = firstLine + '\n' + buffer;
          }
        }

        // Update active stream message content
        setChatMessages((prev) => {
          const next = [...prev];
          if (next[assistantMsgIndex]) {
            next[assistantMsgIndex] = {
              role: 'assistant',
              content: isFirstLine ? buffer : buffer,
              citations: streamedCitations
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
          next[lastIdx].content = `Error streaming response: ${e.message}`;
        }
        return next;
      });
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleLocateClause = (snippet: string) => {
    setHighlightSnippet(snippet);
  };

  const handleClearHighlight = () => {
    setHighlightSnippet(null);
  };

  const handleUploadClick = () => {
    setActiveDoc(null);
    setSelectedDocId('');
    setVersions([]);
    setIsUploading(true);
    setChatMessages([]);
  };

  // Main UI shell render
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <WorkspaceHeader
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDocument={handleSelectDocument}
        onUploadClick={handleUploadClick}
        isLoading={isLoadingAnalysis}
        versionCount={versions.length}
        showBot={showBot}
        onToggleShowBot={setShowBot}
        showConsole={showConsole}
        onToggleConsole={setShowConsole}
      />


      {/* Main Container */}
      <main className="flex-1 overflow-hidden min-h-0 bg-slate-950/40 relative">
        
        {/* State A: File Upload Dropzone / pasted raw text inputs */}
        {(isUploading || !activeDoc) && !isLoadingAnalysis ? (
          <div className="h-full overflow-y-auto py-8">
            <DocumentDropzone
              onAnalyzeText={handleAnalyzeText}
              onAnalyzePdf={handleAnalyzePdf}
              isLoading={isLoadingAnalysis}
            />
          </div>
        ) : isLoadingAnalysis ? (
          /* Analysis loader skeleton */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-200">Analyzing Agreement Context</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Parsing structures, indexing vector chunks, and running plain-English translations...
              </p>
            </div>
          </div>
        ) : (
          /* State B: Document Workspace responsive layout */
          isMobile ? (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Active Mobile Panel View */}
              <div className="flex-1 overflow-hidden min-h-0 p-3">
                {mobileTab === 'reader' && (
                  <DocumentViewer
                    text={activeDoc!.content}
                    highlightSnippet={highlightSnippet}
                    onClearHighlight={handleClearHighlight}
                  />
                )}
                {mobileTab === 'summary' && activeDoc!.summary && (
                  <QuickUnderstand
                    summaryData={activeDoc!.summary}
                    onLocateClause={(snippet) => {
                      handleLocateClause(snippet);
                      setMobileTab('reader'); // navigate back to reader to show highlight
                    }}
                  />
                )}
                {mobileTab === 'chat' && (
                  <GroundedChat
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoadingChat}
                    onHighlightCitation={(snippet) => {
                      handleLocateClause(snippet);
                      setMobileTab('reader'); // navigate back to reader to show highlight
                    }}
                  />
                )}
              </div>

              {/* Mobile Bottom Tab Selection Menu */}
              <div className="shrink-0 bg-slate-900 border-t border-slate-800 grid grid-cols-3 p-1">
                <button
                  onClick={() => setMobileTab('reader')}
                  className={`py-2.5 text-center rounded-lg flex flex-col items-center justify-center transition-all ${
                    mobileTab === 'reader'
                      ? 'text-brand-400 bg-slate-950/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-bold">📄 Reader</span>
                </button>
                <button
                  onClick={() => setMobileTab('summary')}
                  className={`py-2.5 text-center rounded-lg flex flex-col items-center justify-center transition-all ${
                    mobileTab === 'summary'
                      ? 'text-brand-400 bg-slate-950/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-bold">✨ Summary</span>
                </button>
                <button
                  onClick={() => setMobileTab('chat')}
                  className={`py-2.5 text-center rounded-lg flex flex-col items-center justify-center transition-all ${
                    mobileTab === 'chat'
                      ? 'text-brand-400 bg-slate-950/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-bold">💬 Chat</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex overflow-hidden">
              {/* Left Side: Document Reader (Scrolls text and highlights matches) */}
              <div className="w-1/2 p-4 pr-2 h-full flex flex-col min-w-0">
                <DocumentViewer
                  text={activeDoc!.content}
                  highlightSnippet={highlightSnippet}
                  onClearHighlight={handleClearHighlight}
                />
              </div>

              {/* Right Side: Tabbed Analysis Pane */}
              <div className="w-1/2 p-4 pl-2 h-full flex flex-col min-w-0">
                {/* Workspace Navigation Tabs */}
                <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg mb-3 shrink-0 self-start">
                  <button
                    onClick={() => setRightPanelTab('dashboard')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                      rightPanelTab === 'dashboard'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Quick Understand</span>
                  </button>
                  <button
                    onClick={() => setRightPanelTab('chat')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                      rightPanelTab === 'chat'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Ask Assistant</span>
                  </button>
                </div>

                {/* Active Tab Panel */}
                <div className="flex-1 min-h-0">
                  {rightPanelTab === 'dashboard' && activeDoc!.summary && (
                    <QuickUnderstand
                      summaryData={activeDoc!.summary}
                      onLocateClause={handleLocateClause}
                    />
                  )}
                  {rightPanelTab === 'chat' && (
                    <GroundedChat
                      messages={chatMessages}
                      onSendMessage={handleSendMessage}
                      isLoading={isLoadingChat}
                      onHighlightCitation={handleLocateClause}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {showBot && (
        <FloatingAssistant
          activeDoc={activeDoc}
          onOpenFullWorkspace={handleSelectDocument}
          onRefreshHistory={fetchDocumentsHistory}
        />
      )}

      {showConsole && (
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-slate-950 border-t border-slate-800 shadow-2xl z-50 flex flex-col font-mono text-[11px] text-slate-300">
          {/* Console Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 select-none shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="font-bold uppercase tracking-wider text-slate-400">System Debug Console</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  capturedLogs.length = 0;
                  setLogs([]);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-all cursor-pointer font-semibold"
              >
                Clear Logs
              </button>
              <button 
                onClick={() => setShowConsole(false)}
                className="px-2 py-1 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 rounded text-[10px] transition-all cursor-pointer font-semibold"
              >
                Close
              </button>
            </div>
          </div>
          {/* Console Logs */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0 select-text selection:bg-indigo-500/30">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic text-center py-8">No system logs captured yet. Toggle Show Bot or analyze a contract to record events.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 items-start leading-5 break-all border-b border-slate-900 pb-1">
                  <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-rose-400 font-semibold' :
                    log.type === 'warn' ? 'text-amber-400 font-semibold' :
                    'text-emerald-400 font-normal'
                  }>
                    {log.type === 'error' ? '🔴' : log.type === 'warn' ? '⚠️' : '🟢'} {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

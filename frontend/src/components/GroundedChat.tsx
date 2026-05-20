import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Terminal, Eye } from 'lucide-react';

interface Citation {
  chunk_index: number;
  content: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface GroundedChatProps {
  messages: Message[];
  onSendMessage: (query: string) => Promise<void>;
  isLoading: boolean;
  onHighlightCitation: (text: string) => void;
}

export const GroundedChat: React.FC<GroundedChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onHighlightCitation
}) => {
  const [query, setQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Can they use my data for AI training?",
    "How can I terminate my account?",
    "What are the age restrictions?",
    "Are disputes resolved via arbitration?",
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSendMessage(query.trim());
    setQuery('');
  };

  const handleSuggestionClick = (sug: string) => {
    if (isLoading) return;
    onSendMessage(sug);
  };

  // Helper to parse text and inject clickable buttons for citations like [Block 1]
  const parseInlineCitations = (text: string, citations: Citation[] = []) => {
    if (!citations || citations.length === 0) return text;
    
    // Match [Block 1], [Block 2], etc.
    const regex = /(\[Block \d+\])/g;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      const match = part.match(/\[Block (\d+)\]/);
      if (match) {
        const blockNum = parseInt(match[1], 10);
        // Chunks are 0-indexed, Blocks are 1-indexed
        const citation = citations[blockNum - 1];
        if (citation) {
          return (
            <button
              key={index}
              onClick={() => onHighlightCitation(citation.content)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40 rounded hover:bg-emerald-900 transition-all font-sans cursor-pointer"
              title="Click to view clause in reader"
            >
              <Eye className="w-2.5 h-2.5" /> Block {blockNum}
            </button>
          );
        }
      }
      return part;
    });
  };

  return (
    <div className="border border-slate-800 bg-slate-950 rounded-xl flex flex-col h-full overflow-hidden shadow-soft-lg">
      {/* Pane Header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-brand-400">
          <MessageSquare className="w-4 h-4" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversational Assistant</h2>
        </div>
        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5 text-slate-400" /> RAG Grounded
        </span>
      </div>

      {/* Messages Logs */}
      <div className="flex-1 p-5 overflow-y-auto min-h-0 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-slate-500">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-300">Grounded Q&A Assistant</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Ask specific questions about model training, liability caps, refund timelines, or third-party sharing.
              </p>
            </div>
            
            {/* Suggestions bubbles */}
            <div className="flex flex-col gap-2 max-w-xs w-full pt-2">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(sug)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-left text-slate-300 transition-all font-medium"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col gap-1.5 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {/* Role badge */}
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                {msg.role === 'user' ? 'You' : 'TnC Bot'}
              </span>

              {/* Message box */}
              <div 
                className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none shadow'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-bl-none shadow'
                }`}
              >
                <div className="whitespace-pre-line">
                  {msg.role === 'user' 
                    ? msg.content 
                    : parseInlineCitations(msg.content, msg.citations)
                  }
                </div>

                {/* Citations Footer inside bot reply */}
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Retrieved Source References:
                    </span>
                    <div className="flex flex-col gap-1">
                      {msg.citations.map((cit, cIdx) => (
                        <div 
                          key={cIdx}
                          onClick={() => onHighlightCitation(cit.content)}
                          className="flex items-start gap-2 p-1.5 bg-slate-950/50 border border-slate-800/50 rounded text-[10px] text-slate-400 hover:text-slate-300 hover:border-slate-700 transition-all cursor-pointer truncate"
                          title="Click to view clause context"
                        >
                          <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 px-1 rounded text-slate-500 mt-0.5 shrink-0">
                            Block {cIdx + 1}
                          </span>
                          <span className="truncate italic">
                            "{cit.content}"
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Inputs Form */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/10 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder={isLoading ? "Generating response..." : "Ask a question about this contract..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 p-2.5 rounded-lg text-white transition-all shadow flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

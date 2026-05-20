import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Check, Loader2 } from 'lucide-react';

interface DocumentViewerProps {
  text: string;
  highlightSnippet: string | null;
  onClearHighlight: () => void;
}

interface TooltipPosition {
  x: number;
  y: number;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  text,
  highlightSnippet,
  onClearHighlight
}) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  
  // Explanation state
  const [explanationMode, setExplanationMode] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement>(null);

  // Scroll to and highlight search snippet when it changes
  useEffect(() => {
    if (highlightSnippet && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Remove highlight animation after 5 seconds
        const timer = setTimeout(() => {
          onClearHighlight();
        }, 5000);
        
        return () => clearTimeout(timer);
      }, 100);
    }
  }, [highlightSnippet]);

  // Handle selection event
  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const selectionText = selection.toString().trim();
    
    // Ignore small selections or empty space clicks
    if (selectionText.length < 10) {
      // Clear popup if it wasn't currently showing an explanation
      if (!isExplaining && !explanationText) {
        setTooltipPos(null);
        setSelectedText('');
      }
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate coordinates relative to container scroll
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        
        setTooltipPos({
          x: rect.left - containerRect.left + (rect.width / 2),
          y: rect.top - containerRect.top + containerRef.current.scrollTop - 8
        });
        setSelectedText(selectionText);
        
        // Reset explanation state for new selection
        setExplanationMode(null);
        setExplanationText(null);
      }
    } catch (e) {
      console.warn("Could not retrieve selection range coordinates: ", e);
    }
  };

  const handleExplain = async (mode: string) => {
    setExplanationMode(mode);
    setIsExplaining(true);
    setExplanationText(null);

    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clause: selectedText,
          mode: mode
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to explain clause");
      }

      const data = await response.json();
      setExplanationText(data.explanation);
    } catch (err: any) {
      setExplanationText(`Error generating explanation: ${err.message || 'Check connection.'}`);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleCloseTooltip = () => {
    setTooltipPos(null);
    setSelectedText('');
    setExplanationText(null);
    setExplanationMode(null);
    window.getSelection()?.removeAllRanges();
  };

  // Helper to split text and inject highlight markup for citations
  const renderDocumentContent = () => {
    if (!text) return <p className="text-slate-500 italic">No document text loaded.</p>;

    if (!highlightSnippet) {
      // Render standard paragraph blocks separated by double newlines
      return text.split('\n\n').map((para, idx) => (
        <p key={idx} className="mb-4 text-slate-300 leading-relaxed text-sm text-justify">
          {para}
        </p>
      ));
    }

    // Attempt to locate and slice the matching snippet
    const idx = text.toLowerCase().indexOf(highlightSnippet.toLowerCase());
    if (idx === -1) {
      // Snippet not found exactly, render standard
      return text.split('\n\n').map((para, idx) => (
        <p key={idx} className="mb-4 text-slate-300 leading-relaxed text-sm text-justify">
          {para}
        </p>
      ));
    }

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + highlightSnippet.length);
    const after = text.substring(idx + highlightSnippet.length);

    const renderParagraphsWithHighlight = (txt: string, isMatch = false) => {
      if (isMatch) {
        return (
          <mark 
            ref={highlightRef} 
            className="highlight-citation active px-1 py-0.5 rounded text-slate-100 font-medium"
          >
            {txt}
          </mark>
        );
      }
      return txt.split('\n\n').map((p, i) => (
        <span key={i} className="text-slate-300 leading-relaxed text-sm block mb-4 text-justify">
          {p}
        </span>
      ));
    };

    return (
      <>
        {renderParagraphsWithHighlight(before)}
        {renderParagraphsWithHighlight(match, true)}
        {renderParagraphsWithHighlight(after)}
      </>
    );
  };

  return (
    <div className="relative border border-slate-800 bg-slate-950 rounded-xl flex flex-col h-full overflow-hidden shadow-soft-lg">
      {/* Pane Header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Document Reader Mode</h2>
        <span className="text-[10px] text-slate-500">Highlight text to simplify/explain clauses</span>
      </div>

      {/* Reader Content Area */}
      <div 
        ref={containerRef}
        onMouseUp={handleSelection}
        className="flex-1 p-6 overflow-y-auto min-h-0 select-text relative"
      >
        {renderDocumentContent()}

        {/* Explain Tooltip Popover */}
        {tooltipPos && (
          <div 
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px` 
            }}
            className="absolute z-50 -translate-x-1/2 -translate-y-full w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 animate-fade-in text-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Clause Interpreter
              </span>
              <button 
                onClick={handleCloseTooltip}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Selected Phrase info */}
            {!explanationMode && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                  "{selectedText}"
                </p>
                
                <div>
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Translate into tone:
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['Simple', 'Teen-Friendly', 'Technical', 'Legal'].map((m) => (
                      <button
                        key={m}
                        onClick={() => handleExplain(m)}
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:border-brand-500 hover:text-brand-400 transition-all text-left"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Explanation Results */}
            {explanationMode && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-[10px] font-semibold text-slate-300 uppercase px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800">
                    {explanationMode} Tone
                  </span>
                </div>

                {isExplaining ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
                    <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                    <span className="text-xs text-slate-400">Simplifying terms...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-slate-300 text-justify">
                      {explanationText}
                    </p>
                    <div className="text-[9px] text-slate-500 italic border-t border-slate-800/80 pt-2 flex items-center justify-between">
                      <span>Grounded interpretation</span>
                      <span className="flex items-center gap-0.5 text-emerald-500 font-medium">
                        <Check className="w-3 h-3" /> Grounded
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Info, Cpu, ShieldAlert, KeyRound, 
  Trash2, XOctagon, CheckCircle, AlertTriangle, Eye 
} from 'lucide-react';

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

interface QuickUnderstandProps {
  summaryData: SummaryData;
  onLocateClause: (snippet: string) => void;
}

export const QuickUnderstand: React.FC<QuickUnderstandProps> = ({
  summaryData,
  onLocateClause
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rights' | 'ai' | 'terms' | 'clauses'>('overview');

  const {
    summary,
    ai_training,
    permissions,
    ownership,
    termination,
    retention,
    key_clauses = []
  } = summaryData;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'rights', label: 'Rights & Ownership', icon: KeyRound },
    { id: 'ai', label: 'AI Model Policy', icon: Cpu },
    { id: 'terms', label: 'Termination & Data', icon: Trash2 },
    { id: 'clauses', label: 'Key Clauses Explorer', icon: ShieldAlert },
  ];

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-soft-lg flex flex-col h-full">
      {/* Tabs list */}
      <div className="flex border-b border-slate-800 bg-slate-900/50 overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-400 bg-slate-900/30'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-900/10'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="p-6 flex-1 overflow-y-auto min-h-0 bg-slate-950">
        
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Executive Summary</h3>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-sm leading-relaxed">
                {summary || 'No summary generated yet.'}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contract Category</h4>
                <p className="text-sm font-medium text-slate-200">{summaryData.category || 'Uncategorized'}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Key Highlights Found</h4>
                <p className="text-sm font-medium text-slate-200">{key_clauses.length} parsed clauses</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Rights & Ownership */}
        {activeTab === 'rights' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Ownership Card */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <KeyRound className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-200">Content Ownership</h3>
                </div>
                <div className="text-slate-300 text-xs leading-relaxed space-y-2">
                  <p>{ownership || 'No information extracted.'}</p>
                </div>
              </div>

              {/* Permissions Granted Card */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Info className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-200">Permissions You Grant</h3>
                </div>
                <div className="text-slate-300 text-xs leading-relaxed space-y-2">
                  <p>{permissions || 'No information extracted.'}</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: AI Model Policy */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Cpu className="w-6 h-6" />
                <h3 className="text-lg font-semibold text-slate-200">AI Platform Specialization</h3>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed space-y-3">
                <p>{ai_training || 'Analyzing AI training consent protocols and prompt copyrights...'}</p>
                <div className="bg-slate-950/50 border border-slate-800 p-3.5 rounded-lg text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-slate-400">
                    Always review if settings allow opting-out. Many platforms train models on inputs by default unless toggled off manually in settings.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Termination & Data */}
        {activeTab === 'terms' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Cancellation & Termination */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <XOctagon className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-200">Cancellation & Termination</h3>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {termination || 'No cancellation conditions extracted.'}
                </p>
              </div>

              {/* Data Retention */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-200">Data Deletion & Retention</h3>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {retention || 'No retention duration schedules extracted.'}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Tab 5: Key Clauses Explorer */}
        {activeTab === 'clauses' && (
          <div className="space-y-4 animate-fade-in">
            {key_clauses.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No key highlights or specific clauses parsed.</p>
            ) : (
              key_clauses.map((clause, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    clause.status === 'ambiguous' 
                      ? 'bg-amber-950/10 border-amber-500/20 hover:border-amber-500/35' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 px-2 py-0.5 bg-indigo-950/40 rounded border border-indigo-800/30 mr-2">
                        {clause.topic}
                      </span>
                      <h4 className="inline text-sm font-semibold text-slate-200">
                        {clause.clause_title}
                      </h4>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex items-center gap-1">
                      {clause.status === 'ambiguous' ? (
                        <span className="text-[10px] font-medium text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Ambiguous
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Clear
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-slate-400 text-[10px] block uppercase tracking-wider mb-0.5">Plain English Translation</strong>
                      {clause.plain_english}
                    </p>
                    
                    {clause.original_snippet && (
                      <div className="relative group p-2.5 bg-slate-950/70 border border-slate-800/80 rounded text-[11px] text-slate-400 font-mono leading-relaxed max-h-[100px] overflow-y-auto">
                        <strong className="text-slate-500 text-[9px] block uppercase tracking-wider mb-1 font-sans">Source snippet</strong>
                        "{clause.original_snippet}"
                        
                        <button
                          onClick={() => onLocateClause(clause.original_snippet)}
                          className="absolute right-2 top-2 p-1 bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-sans"
                          title="Highlight in document"
                        >
                          <Eye className="w-3.5 h-3.5" /> Locate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};

import React from 'react';
import { Shield, FileText, Upload, Clock, Layers } from 'lucide-react';

interface DocumentInfo {
  id: string;
  name: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

interface WorkspaceHeaderProps {
  documents: DocumentInfo[];
  selectedDocId: string;
  onSelectDocument: (id: string) => void;
  onUploadClick: () => void;
  isLoading: boolean;
  versionCount: number;
  showBot: boolean;
  onToggleShowBot: (val: boolean) => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  documents,
  selectedDocId,
  onSelectDocument,
  onUploadClick,
  isLoading,
  versionCount,
  showBot,
  onToggleShowBot
}) => {
  const activeDoc = documents.find(d => d.id === selectedDocId);

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Title */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="bg-brand-600/10 p-2 rounded-lg border border-brand-500/20 text-brand-400 shrink-0">
          <Shield className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base md:text-xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <span>TnC Bot</span>
            <span className="text-[10px] md:text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Workspace v1.0
            </span>
          </h1>
          <p className="text-[10px] md:text-xs text-slate-400 truncate">Agreement & Contract Interpretation Workspace</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
        {documents.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-soft-sm">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <select
               value={selectedDocId}
               onChange={(e) => onSelectDocument(e.target.value)}
               className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px]"
               disabled={isLoading}
            >
              <option value="" disabled className="bg-slate-900">Select analyzed contract...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id} className="bg-slate-900 text-slate-300">
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Selected Doc Status Metadata */}
        {activeDoc && (
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 border-l border-slate-800 pl-4 mr-2">
            <div className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Category: <strong className="text-slate-300">{activeDoc.category || 'Uncategorized'}</strong></span>
            </div>
            <span>•</span>
            <span>Analyzed: <strong className="text-slate-300">{formatDate(activeDoc.created_at)}</strong></span>
            {versionCount > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1 text-brand-400">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Versions: <strong>{versionCount}</strong></span>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => onToggleShowBot(!showBot)}
          className={`flex items-center gap-1.5 border font-semibold text-xs px-3 py-2 rounded-lg transition-all cursor-pointer shrink-0 ${
            showBot
              ? 'bg-brand-600 border-brand-500 text-white shadow-soft shadow-brand-500/20'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
          title={showBot ? "Hide Assistant" : "Show Assistant"}
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${showBot ? 'bg-white' : 'bg-brand-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${showBot ? 'bg-white' : 'bg-brand-500'}`}></span>
          </span>
          <span>Show Bot</span>
        </button>

        <button
          onClick={onUploadClick}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-800 disabled:text-slate-400 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-all shadow-soft cursor-pointer shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Analyze Contract</span>
        </button>
      </div>
    </header>
  );
};

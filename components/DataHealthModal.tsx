
import React, { useState, useEffect } from 'react';
import { HotelNode, HealthReport, HealthIssue } from '../types';
import { generateHealthReport } from '../services/geminiService';
import { runLocalValidation } from '../utils/validationUtils';
import { X, Activity, CircleCheck, TriangleAlert, CircleAlert, Sparkles, Loader2, RefreshCw, Zap, Search, BrainCircuit } from 'lucide-react';

interface DataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyFix: (nodeId: string, updates: Partial<HotelNode>) => void;
  onLocate?: (nodeId: string) => void; // New prop for locating items
}

const DataHealthModal: React.FC<DataHealthModalProps> = ({ isOpen, onClose, data, onApplyFix, onLocate }) => {
  const [localReport, setLocalReport] = useState<HealthIssue[]>([]);
  const [aiReport, setAiReport] = useState<HealthReport | null>(null);
  
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
  const [fixedIssueIds, setFixedIssueIds] = useState<Set<string>>(new Set());

  // Run Local Validation Immediately on Open
  useEffect(() => {
    if (isOpen) {
      const issues = runLocalValidation(data);
      setLocalReport(issues);
      // If we have no local issues, maybe switch to AI tab or prompt user?
      // Keeping it on local is safer for immediate feedback.
    }
  }, [isOpen, data]);

  const runAIScan = async () => {
    setIsScanningAI(true);
    setError(null);
    try {
      const result = await generateHealthReport(data);
      setAiReport(result);
      setActiveTab('ai'); // Auto switch to AI tab on success
      setFixedIssueIds(new Set()); 
    } catch (error) {
      console.error("AI Scan failed", error);
      setError("AI Analysis failed. The service might be busy or the data structure is too large.");
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleFix = (issue: HealthIssue) => {
    if (issue.fix) {
      onApplyFix(issue.fix.targetId, issue.fix.data);
      setFixedIssueIds(prev => new Set(prev).add(issue.id));
    }
  };

  const handleLocate = (nodeId: string) => {
    if (onLocate) {
        onLocate(nodeId);
        onClose(); // Close modal so user can see the selected node
    }
  };

  if (!isOpen) return null;

  // Combine counts
  const localCount = localReport.length;
  const aiCount = aiReport?.issues?.length || 0;
  
  const getDisplayedIssues = () => {
      if (activeTab === 'local') return localReport;
      if (activeTab === 'ai' && aiReport) return aiReport.issues;
      return [];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden min-h-[500px]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <Activity size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">Hybrid Health Auditor</h2>
                <p className="text-sm text-slate-500">Instant Structural Checks + Deep Semantic AI</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50">
           
           {/* Sidebar: Status & Actions */}
           <div className="w-full md:w-1/3 bg-slate-50 md:border-r border-b md:border-b-0 border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto">
                
                {/* Local Status */}
                <div 
                    onClick={() => setActiveTab('local')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all mb-4 ${activeTab === 'local' ? 'bg-white border-blue-400 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Zap size={16} className="text-amber-500" /> Structural
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{localCount}</span>
                    </div>
                    <div className="text-xs text-slate-500">Checks for empty fields, duplicate names, and structural depth.</div>
                    {localCount === 0 && <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1"><CircleCheck size={12}/> All Good</div>}
                </div>

                {/* AI Status */}
                <div 
                    onClick={() => aiReport && setActiveTab('ai')}
                    className={`p-4 rounded-xl border transition-all relative ${activeTab === 'ai' ? 'bg-white border-violet-400 shadow-md ring-1 ring-violet-100' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <BrainCircuit size={16} className="text-violet-500" /> Semantic (AI)
                        </span>
                        {aiReport ? (
                            <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs font-bold">{aiCount}</span>
                        ) : (
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Not Run</span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 mb-4">Analyzes logic, typos, contradictions, and ambiguity.</div>
                    
                    {!isScanningAI ? (
                         <button 
                            onClick={(e) => { e.stopPropagation(); runAIScan(); }}
                            className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <Sparkles size={14} /> {aiReport ? 'Re-Run Deep Scan' : 'Run Deep Scan'}
                        </button>
                    ) : (
                        <button disabled className="w-full py-2 bg-violet-50 text-violet-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-wait">
                            <Loader2 size={14} className="animate-spin" /> Analyzing...
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                        <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}
           </div>

           {/* Main List */}
           <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        {activeTab === 'local' ? <Zap size={16} className="text-amber-500"/> : <BrainCircuit size={16} className="text-violet-500"/>}
                        {activeTab === 'local' ? 'Structural Issues' : 'Semantic AI Findings'}
                    </h3>
                    <div className="text-xs text-slate-400 font-medium">
                        {getDisplayedIssues().length} items found
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {getDisplayedIssues().length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                            <CircleCheck size={48} className="mb-2 text-emerald-500" />
                            <p>No issues found in this category.</p>
                            {activeTab === 'local' && !aiReport && (
                                <p className="text-xs mt-2">Try running the Deep AI Scan for logical checks.</p>
                            )}
                        </div>
                    ) : (
                        getDisplayedIssues().map(issue => {
                            const isFixed = fixedIssueIds.has(issue.id);
                            return (
                                <div key={issue.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                issue.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {issue.severity}
                                            </span>
                                            <span className="font-mono text-xs text-slate-400">Node: {issue.nodeName}</span>
                                        </div>
                                        {onLocate && (
                                            <button 
                                                onClick={() => handleLocate(issue.nodeId)}
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                title="Select in Editor"
                                            >
                                                <Search size={12} /> Locate
                                            </button>
                                        )}
                                    </div>
                                    
                                    <p className="text-slate-700 text-sm mb-3 font-medium">{issue.message}</p>

                                    <div className="flex items-center gap-2">
                                        {issue.fix && !isFixed ? (
                                            <button 
                                                onClick={() => handleFix(issue)}
                                                className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                            >
                                                <Sparkles size={12} /> Fix: {issue.fix.description}
                                            </button>
                                        ) : isFixed ? (
                                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CircleCheck size={12}/> FIXED</span>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DataHealthModal;

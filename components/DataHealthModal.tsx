
import React, { useState, useEffect } from 'react';
import { HotelNode, HealthReport, HealthIssue } from '../types';
import { generateHealthReport } from '../services/geminiService';
import { X, Activity, CheckCircle, AlertTriangle, AlertCircle, Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface DataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyFix: (nodeId: string, updates: Partial<HotelNode>) => void;
}

const DataHealthModal: React.FC<DataHealthModalProps> = ({ isOpen, onClose, data, onApplyFix }) => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'critical' | 'warning' | 'optimization'>('critical');
  const [fixedIssueIds, setFixedIssueIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && !report) {
      runScan();
    }
  }, [isOpen]);

  const runScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const result = await generateHealthReport(data);
      setReport(result);
      setFixedIssueIds(new Set()); // Reset fixed state
    } catch (error) {
      console.error("Scan failed", error);
      setError("Analysis failed. The data structure might be too large for a single pass, or the AI service timed out.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFix = (issue: HealthIssue) => {
    if (issue.fix) {
      onApplyFix(issue.fix.targetId, issue.fix.data);
      setFixedIssueIds(prev => new Set(prev).add(issue.id));
    }
  };

  const handleFixAll = () => {
    if (!report) return;
    const currentIssues = report.issues.filter(i => i.severity === activeTab && !fixedIssueIds.has(i.id));
    
    currentIssues.forEach(issue => {
      if (issue.fix) {
        onApplyFix(issue.fix.targetId, issue.fix.data);
        setFixedIssueIds(prev => new Set(prev).add(issue.id));
      }
    });
  };

  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const getFilteredIssues = () => {
    return report?.issues.filter(i => i.severity === activeTab) || [];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden min-h-[400px]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <Activity size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">AI Data Health Auditor</h2>
                <p className="text-sm text-slate-500">Semantic analysis & Context verification</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50 relative">
           
           {/* Fallback States (Scanning / Error) */}
           {!report && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
               {isScanning && (
                 <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 size={48} className="animate-spin text-emerald-500" />
                    <p className="text-slate-600 font-medium">Scanning data structure...</p>
                    <p className="text-slate-400 text-sm">This may take a moment for large hotels.</p>
                 </div>
               )}

               {error && !isScanning && (
                 <div className="flex flex-col items-center justify-center space-y-4 text-center max-w-md px-4">
                    <div className="bg-red-100 p-3 rounded-full text-red-600 mb-2">
                       <AlertTriangle size={32} />
                    </div>
                    <p className="text-slate-800 font-bold text-lg">Analysis Failed</p>
                    <p className="text-slate-600 text-sm">{error}</p>
                    <button 
                       onClick={runScan}
                       className="mt-4 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                       <RefreshCw size={16} /> Try Again
                    </button>
                 </div>
               )}
             </div>
           )}

           {/* Results Layout (Only shown when report exists) */}
           {report && (
             <>
               {/* Sidebar / Score Panel */}
               <div className="w-full md:w-1/3 bg-slate-50 md:border-r border-b md:border-b-0 border-slate-200 p-6 flex flex-col items-center text-center overflow-y-auto shrink-0">
                  <div className="relative mb-6">
                     <svg className="w-40 h-40 transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-200" />
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent" 
                           strokeDasharray={440} 
                           strokeDashoffset={440 - (440 * report.score) / 100} 
                           className={`${getScoreColor(report.score)} transition-all duration-1000 ease-out`} 
                        />
                     </svg>
                     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <span className={`text-4xl font-bold ${getScoreColor(report.score)}`}>{report.score}</span>
                     </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-2">Health Score</h3>
                  <p className="text-sm text-slate-500 mb-6 px-4">{report.summary}</p>

                  <div className="w-full space-y-2">
                     <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                        <span className="flex items-center gap-2 text-red-600 font-medium text-sm"><AlertCircle size={16}/> Critical</span>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{report.issues.filter(i => i.severity === 'critical').length}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                        <span className="flex items-center gap-2 text-amber-600 font-medium text-sm"><AlertTriangle size={16}/> Warnings</span>
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{report.issues.filter(i => i.severity === 'warning').length}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                        <span className="flex items-center gap-2 text-blue-600 font-medium text-sm"><Sparkles size={16}/> Optimize</span>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{report.issues.filter(i => i.severity === 'optimization').length}</span>
                     </div>
                  </div>

                  <button 
                    onClick={runScan}
                    className="mt-8 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                  >
                     <RefreshCw size={14} /> Re-scan Data
                  </button>
               </div>

               {/* Issues Panel */}
               <div className="flex-1 bg-white flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 px-6 pt-4 gap-6 shrink-0">
                       <button 
                          onClick={() => setActiveTab('critical')}
                          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'critical' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                       >
                          Critical Issues
                       </button>
                       <button 
                          onClick={() => setActiveTab('warning')}
                          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'warning' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                       >
                          Warnings
                       </button>
                       <button 
                          onClick={() => setActiveTab('optimization')}
                          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'optimization' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                       >
                          Optimizations
                       </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                       {getFilteredIssues().length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                             <CheckCircle size={48} className="mb-2 text-emerald-500" />
                             <p>No issues found in this category.</p>
                          </div>
                       ) : (
                          getFilteredIssues().map(issue => {
                             const isFixed = fixedIssueIds.has(issue.id);
                             return (
                                <div key={issue.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                   <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                         <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{issue.nodeName}</span>
                                         {isFixed && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={12}/> FIXED</span>}
                                      </div>
                                   </div>
                                   
                                   <p className="text-slate-700 text-sm mb-3">{issue.message}</p>

                                   {issue.fix && !isFixed && (
                                      <button 
                                        onClick={() => handleFix(issue)}
                                        className="text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                                      >
                                         <Sparkles size={12} /> Auto-Fix: {issue.fix.description}
                                      </button>
                                   )}
                                </div>
                             );
                          })
                       )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                        <button 
                           onClick={handleFixAll}
                           disabled={getFilteredIssues().filter(i => !fixedIssueIds.has(i.id)).length === 0}
                           className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
                        >
                           <Sparkles size={16} /> Fix All {activeTab === 'optimization' ? 'Suggestions' : 'Issues'}
                        </button>
                    </div>
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default DataHealthModal;

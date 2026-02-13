
import React, { useState, useEffect } from 'react';
import { HotelNode, HealthReport, HealthIssue } from '../types';
import { generateHealthReport, autoFixDatabase, AutoFixAction } from '../services/geminiService';
import { runLocalValidation } from '../utils/validationUtils';
import { X, Activity, Check, TriangleAlert, Sparkles, Loader2, RefreshCw, Zap, Search, BrainCircuit, Wand2, ArrowRight } from 'lucide-react';

interface DataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyFix: (nodeId: string, updates: Partial<HotelNode>) => void;
  onLocate?: (nodeId: string) => void;
  onAutoFixApply?: (action: AutoFixAction) => void; // New prop for complex actions (move/type)
}

const DataHealthModal: React.FC<DataHealthModalProps> = ({ isOpen, onClose, data, onApplyFix, onLocate, onAutoFixApply }) => {
  const [localReport, setLocalReport] = useState<HealthIssue[]>([]);
  const [autoFixes, setAutoFixes] = useState<AutoFixAction[]>([]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'autofix'>('local');
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  // Run Local Validation Immediately on Open
  useEffect(() => {
    if (isOpen) {
      const issues = runLocalValidation(data);
      setLocalReport(issues);
    }
  }, [isOpen, data]);

  const runAutoFixScan = async () => {
    setIsScanning(true);
    setFixedIds(new Set());
    try {
      const result = await autoFixDatabase(data);
      setAutoFixes(result);
      setActiveTab('autofix');
    } catch (error) {
      console.error("AutoFix Scan failed", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyFix = (action: AutoFixAction) => {
    if (onAutoFixApply) {
        onAutoFixApply(action);
        setFixedIds(prev => new Set(prev).add(action.id));
    }
  };

  const handleMagicWand = () => {
      // Apply all remaining fixes
      const pending = autoFixes.filter(f => !fixedIds.has(f.id));
      pending.forEach(action => {
          if (onAutoFixApply) onAutoFixApply(action);
      });
      const allIds = pending.map(p => p.id);
      setFixedIds(prev => new Set([...prev, ...allIds]));
  };

  const handleLocalFix = (issue: HealthIssue) => {
      if (issue.fix) {
          onApplyFix(issue.fix.targetId, issue.fix.data);
          setFixedIds(prev => new Set(prev).add(issue.id));
      }
  };

  const handleLocate = (nodeId: string) => {
    if (onLocate) {
        onLocate(nodeId);
        onClose(); 
    }
  };

  if (!isOpen) return null;

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
                <h2 className="text-xl font-bold text-slate-800">Auto-Pilot Center</h2>
                <p className="text-sm text-slate-500">Validation & Automated Repair</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50">
           
           {/* Sidebar */}
           <div className="w-full md:w-1/3 bg-slate-50 md:border-r border-b md:border-b-0 border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto">
                
                {/* Local Status */}
                <div 
                    onClick={() => setActiveTab('local')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all mb-4 ${activeTab === 'local' ? 'bg-white border-blue-400 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Zap size={16} className="text-amber-500" /> Validation
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{localReport.length}</span>
                    </div>
                    <div className="text-xs text-slate-500">Real-time check for empty fields and structure depth.</div>
                </div>

                {/* Auto-Fix Status */}
                <div 
                    onClick={() => autoFixes.length > 0 && setActiveTab('autofix')}
                    className={`p-4 rounded-xl border transition-all relative ${activeTab === 'autofix' ? 'bg-white border-violet-400 shadow-md ring-1 ring-violet-100' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Sparkles size={16} className="text-violet-500" /> Auto-Fixer
                        </span>
                        {autoFixes.length > 0 ? (
                            <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs font-bold">{autoFixes.length}</span>
                        ) : (
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Ready</span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 mb-4">Deep scan to fix types, values, and placement.</div>
                    
                    {!isScanning ? (
                         <button 
                            onClick={(e) => { e.stopPropagation(); runAutoFixScan(); }}
                            className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <BrainCircuit size={14} /> Scan & Repair
                        </button>
                    ) : (
                        <button disabled className="w-full py-2 bg-violet-50 text-violet-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-wait">
                            <Loader2 size={14} className="animate-spin" /> Analyzing...
                        </button>
                    )}
                </div>
           </div>

           {/* Main List */}
           <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        {activeTab === 'local' ? 'Structural Issues' : 'AI Suggested Repairs'}
                    </h3>
                    
                    {activeTab === 'autofix' && autoFixes.length > 0 && (
                        <button 
                            onClick={handleMagicWand}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all"
                        >
                            <Wand2 size={14} /> Fix All (Magic Wand)
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* AUTO FIX LIST */}
                    {activeTab === 'autofix' && (
                        autoFixes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Sparkles size={48} className="mb-2 text-violet-300" />
                                <p>Run the Auto-Fixer scan to see suggestions.</p>
                            </div>
                        ) : (
                            autoFixes.map(action => {
                                const isFixed = fixedIds.has(action.id);
                                return (
                                    <div key={action.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                    action.type === 'move' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {action.type}
                                                </span>
                                                <span className="font-mono text-xs text-slate-400">Target: {action.targetId}</span>
                                            </div>
                                        </div>
                                        
                                        <p className="text-slate-700 text-sm mb-3 font-medium">{action.reasoning}</p>

                                        <div className="flex items-center gap-2">
                                            {!isFixed ? (
                                                <button 
                                                    onClick={() => handleApplyFix(action)}
                                                    className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
                                                >
                                                    <Wand2 size={12} /> Apply Fix
                                                </button>
                                            ) : (
                                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> APPLIED</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )
                    )}

                    {/* LOCAL VALIDATION LIST */}
                    {activeTab === 'local' && (
                        localReport.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Check size={48} className="mb-2 text-emerald-500" />
                                <p>No immediate validation errors.</p>
                            </div>
                        ) : (
                            localReport.map(issue => {
                                const isFixed = fixedIds.has(issue.id);
                                return (
                                    <div key={issue.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    issue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {issue.severity}
                                                </span>
                                                <span className="font-mono text-xs text-slate-400">Node: {issue.nodeName}</span>
                                            </div>
                                            {onLocate && (
                                                <button onClick={() => handleLocate(issue.nodeId)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Search size={12} /> Locate</button>
                                            )}
                                        </div>
                                        <p className="text-slate-700 text-sm mb-3 font-medium">{issue.message}</p>
                                        {issue.fix && !isFixed && (
                                            <button onClick={() => handleLocalFix(issue)} className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                                <Sparkles size={12} /> Fix: {issue.fix.description}
                                            </button>
                                        )}
                                        {isFixed && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> FIXED</span>}
                                    </div>
                                )
                            })
                        )
                    )}
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DataHealthModal;

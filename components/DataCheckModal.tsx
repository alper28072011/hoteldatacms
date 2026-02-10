
import React, { useState, useRef } from 'react';
import { HotelNode, DataComparisonReport, SuggestedAction } from '../types';
import { runDataCheck } from '../services/geminiService';
import { X, Scale, Globe, FileText, Type, ArrowRight, Loader2, CheckCircle, AlertTriangle, AlertCircle, PlusCircle, MinusCircle, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';

interface DataCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyAction: (action: SuggestedAction) => void;
}

const DataCheckModal: React.FC<DataCheckModalProps> = ({ isOpen, onClose, data, onApplyAction }) => {
  const [activeTab, setActiveTab] = useState<'url' | 'text' | 'file'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<DataComparisonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State for expandable rows and tracking fixed items
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [fixedItemIds, setFixedItemIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRunCheck = async () => {
    setIsChecking(true);
    setReport(null);
    setError(null);
    setFixedItemIds(new Set()); // Reset fixed items

    try {
      let inputValue = '';
      let mimeType = '';

      if (activeTab === 'url') {
        if (!urlInput.trim()) throw new Error("Please enter a valid URL.");
        inputValue = urlInput;
      } else if (activeTab === 'text') {
        if (!textInput.trim()) throw new Error("Please enter some text to check.");
        inputValue = textInput;
      } else if (activeTab === 'file') {
        if (!selectedFile) throw new Error("Please upload a file.");
        
        // Convert to base64
        inputValue = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        mimeType = selectedFile.type;
      }

      const result = await runDataCheck(data, activeTab, inputValue, mimeType);
      setReport(result);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during the check.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyFix = (e: React.MouseEvent, item: any) => {
      e.stopPropagation();
      if (item.suggestedAction) {
          onApplyAction(item.suggestedAction);
          setFixedItemIds(prev => new Set(prev).add(item.id));
      }
  };

  const toggleExpand = (id: string) => {
      setExpandedItemId(prev => prev === id ? null : id);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'match': return <CheckCircle size={16} className="text-emerald-500" />;
      case 'conflict': return <AlertTriangle size={16} className="text-red-500" />;
      case 'missing_internal': return <PlusCircle size={16} className="text-blue-500" />;
      case 'missing_external': return <MinusCircle size={16} className="text-slate-400" />;
      default: return <AlertCircle size={16} />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'match': return 'Consistent';
      case 'conflict': return 'Conflict Found';
      case 'missing_internal': return 'Missing in DB';
      case 'missing_external': return 'Missing in Target';
      default: return cat;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-white/20 p-2 rounded-lg">
               <Scale size={24} />
            </div>
            <div>
               <h2 className="text-xl font-bold">Data Check & Validation</h2>
               <p className="text-white/80 text-sm">Compare your internal database against real-world sources.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
           
           {/* Sidebar: Inputs */}
           <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto">
              
              <div className="mb-6">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Source Type</label>
                 <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button 
                       onClick={() => setActiveTab('url')}
                       className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex justify-center items-center gap-2 ${activeTab === 'url' ? 'bg-cyan-50 text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       <Globe size={14} /> Web
                    </button>
                    <button 
                       onClick={() => setActiveTab('text')}
                       className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex justify-center items-center gap-2 ${activeTab === 'text' ? 'bg-cyan-50 text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       <Type size={14} /> Text
                    </button>
                    <button 
                       onClick={() => setActiveTab('file')}
                       className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex justify-center items-center gap-2 ${activeTab === 'file' ? 'bg-cyan-50 text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       <FileText size={14} /> File
                    </button>
                 </div>
              </div>

              <div className="flex-1">
                 {activeTab === 'url' && (
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">Target URL</label>
                       <input 
                          type="url" 
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://www.example.com/hotel-info"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                       />
                       <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                          The AI will browse this page live (using Google Search Grounding) and cross-reference it with your database.
                       </p>
                    </div>
                 )}

                 {activeTab === 'text' && (
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">Target Text</label>
                       <textarea 
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Paste a review, an email, or a rule list here..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none h-40 resize-none"
                       />
                    </div>
                 )}

                 {activeTab === 'file' && (
                    <div>
                       <div 
                          className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                       >
                          {selectedFile ? (
                             <div className="text-cyan-700 font-medium text-sm truncate">{selectedFile.name}</div>
                          ) : (
                             <div className="text-slate-500 text-sm">Click to upload PDF/Image</div>
                          )}
                       </div>
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.txt,.md,image/*"/>
                    </div>
                 )}
              </div>

              {error && (
                 <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {error}
                 </div>
              )}

              <button 
                 onClick={handleRunCheck}
                 disabled={isChecking}
                 className="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                 {isChecking ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                 Run Comparison
              </button>
           </div>

           {/* Main Content: Results */}
           <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden relative">
              
              {!report && !isChecking && (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Scale size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Ready to Validate</p>
                    <p className="text-sm">Select a source and run the check to see the diff report.</p>
                 </div>
              )}

              {isChecking && (
                 <div className="flex flex-col items-center justify-center h-full text-cyan-600">
                    <Loader2 size={48} className="animate-spin mb-4" />
                    <p className="font-bold text-lg">Analyzing Data...</p>
                    <p className="text-sm text-slate-500 mt-2">Comparing internal nodes against external source.</p>
                 </div>
              )}

              {report && (
                 <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-white">
                       <h3 className="text-lg font-bold text-slate-800 mb-1">Validation Report</h3>
                       <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                       {report.items.map((item) => {
                          const isExpanded = expandedItemId === item.id;
                          const isFixed = fixedItemIds.has(item.id);
                          const hasAction = (item.category === 'conflict' || item.category === 'missing_internal') && item.suggestedAction;

                          return (
                            <div 
                                key={item.id} 
                                className={`
                                    border rounded-lg transition-all duration-300 overflow-hidden cursor-pointer shadow-sm hover:shadow-md
                                    ${item.category === 'conflict' ? 'bg-red-50/50 border-red-200' : 
                                      item.category === 'missing_internal' ? 'bg-blue-50/50 border-blue-200' :
                                      item.category === 'match' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}
                                    ${isFixed ? 'opacity-50 grayscale' : ''}
                                `}
                                onClick={() => toggleExpand(item.id)}
                            >
                                {/* Header Row */}
                                <div className="p-4 flex gap-4 items-center">
                                    <div className="mt-0.5 shrink-0">{getCategoryIcon(item.category)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-800 text-sm">{item.field}</span>
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                                isFixed ? 'bg-emerald-600 text-white' :
                                                item.category === 'conflict' ? 'bg-red-100 text-red-700' :
                                                item.category === 'missing_internal' ? 'bg-blue-100 text-blue-700' :
                                                item.category === 'match' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {isFixed ? 'UPDATED' : getCategoryLabel(item.category)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 truncate">{item.description}</p>
                                    </div>
                                    <div className="shrink-0 text-slate-400">
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>

                                {/* Detailed View (Expandable) */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 border-t border-slate-200/50 bg-white/50 animate-in slide-in-from-top-2">
                                        
                                        <div className="grid grid-cols-2 gap-6 mt-4">
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Database</div>
                                                <div className="font-mono text-sm text-slate-700 break-words">
                                                    {item.internalValue ? item.internalValue : <span className="text-slate-400 italic">Not found</span>}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">External Source</div>
                                                <div className="font-mono text-sm text-slate-700 break-words">
                                                    {item.externalValue ? item.externalValue : <span className="text-slate-400 italic">Not found</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {hasAction && !isFixed && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                                <button 
                                                    onClick={(e) => handleApplyFix(e, item)}
                                                    className={`
                                                        px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm transition-all
                                                        ${item.category === 'missing_internal' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
                                                    `}
                                                >
                                                    {item.category === 'missing_internal' ? <Download size={16} /> : <RefreshCw size={16} />}
                                                    {item.category === 'missing_internal' ? 'Import to Database' : 'Update Database'}
                                                </button>
                                            </div>
                                        )}

                                        {isFixed && (
                                            <div className="mt-4 text-center text-emerald-600 font-medium text-sm flex items-center justify-center gap-2">
                                                <CheckCircle size={16} /> Action Applied Successfully
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                          );
                       })}
                       
                       {report.items.length === 0 && (
                          <div className="text-center py-10 text-slate-400 italic">No discrepancies or specific matches found.</div>
                       )}
                    </div>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default DataCheckModal;

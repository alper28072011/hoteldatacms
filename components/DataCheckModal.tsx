
import React, { useState, useRef } from 'react';
import { HotelNode, DataComparisonReport, SuggestedAction } from '../types';
import { runDataCheck } from '../services/geminiService';
import { X, Scale, Globe, FileText, Type, ArrowRight, Loader2, Check, TriangleAlert, Info, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';

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
    setFixedItemIds(new Set());

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
        
        inputValue = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
              const res = reader.result as string;
              resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
          };
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
      case 'match': return <Check size={16} className="text-emerald-500" />;
      case 'conflict': return <TriangleAlert size={16} className="text-red-500" />;
      case 'missing_internal': return <Plus size={16} className="text-blue-500" />;
      case 'missing_external': return <Minus size={16} className="text-slate-400" />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden">
        
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

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
           
           {/* Sidebar */}
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
                          The AI will browse the URL content and compare it with your current structure.
                       </p>
                    </div>
                 )}

                 {activeTab === 'text' && (
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">Paste Content</label>
                       <textarea 
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Paste menu items, price lists, or policy text here..."
                          className="w-full h-40 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                       />
                    </div>
                 )}

                 {activeTab === 'file' && (
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">Upload File</label>
                       <div 
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${selectedFile ? 'border-cyan-400 bg-cyan-50' : 'border-slate-300 hover:border-cyan-400'}`}
                          onClick={() => fileInputRef.current?.click()}
                       >
                           {selectedFile ? (
                               <div>
                                   <FileText className="mx-auto text-cyan-600 mb-2" size={24}/>
                                   <div className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</div>
                               </div>
                           ) : (
                               <div className="text-slate-400">
                                   <span className="block text-sm">Click to upload</span>
                                   <span className="text-xs">PDF, Image, or JSON</span>
                               </div>
                           )}
                       </div>
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    </div>
                 )}
              </div>

              {error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2">
                      <TriangleAlert size={14} className="shrink-0 mt-0.5" />
                      {error}
                  </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-200">
                 <button 
                    onClick={handleRunCheck}
                    disabled={isChecking}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    {isChecking ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    Run Comparison
                 </button>
              </div>
           </div>

           {/* Results Area */}
           <div className="flex-1 bg-white flex flex-col min-h-0">
               {!report ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                       <Scale size={48} className="mb-4 text-cyan-200" />
                       <p className="text-lg font-medium text-slate-500">Ready to Compare</p>
                       <p className="text-sm">Select a source and run the check to see discrepancies.</p>
                   </div>
               ) : (
                   <div className="flex flex-col h-full">
                       <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                           <h3 className="font-bold text-slate-700">Analysis Report</h3>
                           <p className="text-sm text-slate-500 mt-1">{report.summary}</p>
                       </div>
                       <div className="flex-1 overflow-y-auto p-4 space-y-3">
                           {report.items.map((item) => {
                               const isFixed = fixedItemIds.has(item.id);
                               const isExpanded = expandedItemId === item.id;
                               
                               return (
                                   <div key={item.id} className={`border rounded-lg transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                       <div 
                                           className="p-4 flex items-center justify-between cursor-pointer"
                                           onClick={() => toggleExpand(item.id)}
                                       >
                                           <div className="flex items-center gap-3">
                                               <div className={`p-2 rounded-full bg-slate-50 border border-slate-100`}>
                                                   {getCategoryIcon(item.category)}
                                               </div>
                                               <div>
                                                   <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                       {item.field}
                                                       <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.category}</span>
                                                   </div>
                                                   <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                                               </div>
                                           </div>
                                           <div className="flex items-center gap-2">
                                                {item.suggestedAction && !isFixed && (
                                                    <button 
                                                        onClick={(e) => handleApplyFix(e, item)}
                                                        className="px-3 py-1.5 text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded hover:bg-cyan-100 flex items-center gap-1.5 transition-colors"
                                                    >
                                                        Apply Fix
                                                    </button>
                                                )}
                                                {isFixed && (
                                                    <span className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded flex items-center gap-1">
                                                        <Check size={12} /> Fixed
                                                    </span>
                                                )}
                                                <button className="text-slate-400 hover:text-slate-600">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                           </div>
                                       </div>
                                       
                                       {isExpanded && (
                                           <div className="px-4 pb-4 pt-0 text-xs border-t border-slate-50 bg-slate-50/30">
                                               <div className="grid grid-cols-2 gap-4 mt-3">
                                                   <div className="bg-red-50 p-2 rounded border border-red-100">
                                                       <div className="font-bold text-red-800 mb-1">Internal Value</div>
                                                       <div className="font-mono text-red-600 break-all">{item.internalValue || 'N/A'}</div>
                                                   </div>
                                                   <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                                                       <div className="font-bold text-emerald-800 mb-1">External Source</div>
                                                       <div className="font-mono text-emerald-600 break-all">{item.externalValue || 'N/A'}</div>
                                                   </div>
                                               </div>
                                           </div>
                                       )}
                                   </div>
                               );
                           })}
                           {report.items.length === 0 && (
                               <div className="text-center py-10 text-slate-400">
                                   <Check size={32} className="mx-auto mb-2 text-emerald-400" />
                                   <p>Everything looks consistent!</p>
                               </div>
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

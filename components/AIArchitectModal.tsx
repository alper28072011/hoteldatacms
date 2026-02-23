
import React, { useState, useRef } from 'react';
import { processArchitectCommand, processArchitectFile } from '../services/geminiService';
import { HotelNode, ArchitectResponse, ArchitectAction } from '../types';
import { Sparkles, X, Check, TriangleAlert, ArrowRight, Loader2, FileText, UploadCloud, MessageSquare, Info } from 'lucide-react';

interface AIArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyActions: (actions: ArchitectAction[]) => void;
}

const AIArchitectModal: React.FC<AIArchitectModalProps> = ({ isOpen, onClose, data, onApplyActions }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'file'>('chat');
  
  // Chat State
  const [command, setCommand] = useState('');
  
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposal, setProposal] = useState<ArchitectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setCommand('');
    setSelectedFile(null);
    setProposal(null);
    setError(null);
  };

  const handleAnalyzeChat = async () => {
    if (!command.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setProposal(null);

    try {
      const result = await processArchitectCommand(data, command);
      setProposal(result);
    } catch (err) {
      setError("Failed to generate a plan. Please try again or be more specific.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    setProposal(null);

    try {
      // Convert file to Base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove Data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const result = await processArchitectFile(data, base64Data, selectedFile.type);
      setProposal(result);

    } catch (err) {
      console.error(err);
      setError("Failed to process the file. Ensure it is a valid text, PDF, or image file.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (proposal && proposal.actions) {
      onApplyActions(proposal.actions);
      onClose();
      resetState();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-primary-600 p-6 flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-2 text-white/90 mb-1">
              <Sparkles size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">AI Architect</span>
            </div>
            <h2 className="text-xl font-bold text-white">Data Structure Assistant</h2>
            <p className="text-white/70 text-sm mt-1">
               {activeTab === 'chat' ? 'Modify your structure with natural language.' : 'Import data intelligently from external files.'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        {!proposal && (
          <div className="flex border-b border-slate-100 bg-slate-50/50">
             <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'chat' ? 'border-primary-500 text-primary-700 bg-primary-100/50' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
             >
                <MessageSquare size={16} /> Natural Language
             </button>
             <button 
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'file' ? 'border-primary-500 text-primary-700 bg-primary-100/50' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
             >
                <UploadCloud size={16} /> File Import
             </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto min-h-0 flex-1">
          {!proposal ? (
            <div className="space-y-4">
              
              {/* CHAT TAB CONTENT */}
              {activeTab === 'chat' && (
                <>
                  <label className="block text-sm font-semibold text-slate-700">Your Command</label>
                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="e.g., Add 'French Fries' to the Snack Bar menu for 5 dollars. OR Create a new category called 'Gym Rules'."
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 placeholder:text-slate-400"
                    autoFocus
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleAnalyzeChat}
                      disabled={isAnalyzing || !command.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Analyzing Structure...
                        </>
                      ) : (
                        <>
                          Analyze & Plan <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* FILE TAB CONTENT */}
              {activeTab === 'file' && (
                 <div className="space-y-6">
                    <div 
                      className={`
                        border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                        ${selectedFile ? 'border-primary-300 bg-primary-50' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'}
                      `}
                      onClick={() => fileInputRef.current?.click()}
                    >
                       <div className={`p-4 rounded-full mb-3 ${selectedFile ? 'bg-primary-200 text-primary-700' : 'bg-slate-100 text-slate-400'}`}>
                          {selectedFile ? <FileText size={32} /> : <UploadCloud size={32} />}
                       </div>
                       
                       {selectedFile ? (
                          <div>
                             <p className="text-sm font-bold text-slate-800">{selectedFile.name}</p>
                             <p className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Unknown Type'}</p>
                             <p className="text-xs text-primary-600 font-medium mt-3">Click to change file</p>
                          </div>
                       ) : (
                          <div>
                             <p className="text-sm font-bold text-slate-700">Click to upload a document</p>
                             <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                                Supports PDF, TXT, CSV, JSON or Images. The AI will read the content and map it to your structure.
                             </p>
                          </div>
                       )}
                       <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          className="hidden" 
                          accept=".pdf,.txt,.csv,.json,.md,image/*"
                       />
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                          onClick={handleAnalyzeFile}
                          disabled={isAnalyzing || !selectedFile}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 size={18} className="animate-spin" /> Reading File...
                            </>
                          ) : (
                            <>
                              Process File <ArrowRight size={18} />
                            </>
                          )}
                        </button>
                    </div>
                 </div>
              )}
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                  <TriangleAlert size={16} />
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Proposal Summary */}
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                <h3 className="text-emerald-800 font-semibold mb-1 flex items-center gap-2">
                  <Check size={16} /> Proposal Ready
                </h3>
                <p className="text-emerald-700 text-sm">{proposal.summary}</p>
              </div>

              {/* Actions List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Planned Actions</h4>
                {(proposal.actions && proposal.actions.length > 0) ? (
                    proposal.actions.map((action, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex gap-3">
                        <div className={`
                          shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase
                          ${action.type === 'add' ? 'bg-blue-100 text-blue-600' : ''}
                          ${action.type === 'update' ? 'bg-amber-100 text-amber-600' : ''}
                          ${action.type === 'delete' ? 'bg-red-100 text-red-600' : ''}
                        `}>
                          {action.type.slice(0, 3)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs text-slate-400">Target ID: {action.targetId}</span>
                            {action.data?.type && (
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                                {action.data.type}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-800 text-sm font-medium truncate mt-1">
                            {action.type === 'add' && `New Node: ${action.data?.name || 'Unnamed'}`}
                            {action.type === 'update' && `Update: ${action.data?.name || 'Fields'}`}
                            {action.type === 'delete' && 'Remove Node'}
                          </p>
                          {action.reason && (
                            <p className="text-xs text-slate-500 mt-1 italic">"{action.reason}"</p>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
                      <Info size={20} />
                      <div className="text-sm">
                        No structural changes needed or duplicates found.
                        <div className="text-xs opacity-70">The AI decided not to create new actions based on your command.</div>
                      </div>
                   </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setProposal(null)}
                  className="flex-1 px-4 py-2.5 text-slate-600 font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleApply}
                  disabled={!proposal.actions || proposal.actions.length === 0}
                  className="flex-1 px-4 py-2.5 text-white font-medium bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <Check size={18} /> Confirm & Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIArchitectModal;

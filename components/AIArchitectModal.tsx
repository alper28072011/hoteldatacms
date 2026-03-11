
import React, { useState, useRef, useMemo } from 'react';
import { processArchitectCommand, processArchitectFile } from '../services/geminiService';
import { HotelNode, ArchitectResponse, ArchitectAction, NodeTemplate, NodeType } from '../types';
import { Sparkles, X, Check, TriangleAlert, ArrowRight, Loader2, FileText, UploadCloud, MessageSquare, Info, Table, Download, FileSpreadsheet } from 'lucide-react';
import { useHotel } from '../contexts/HotelContext';
import * as XLSX from 'xlsx';
import { generateId } from '../utils/treeUtils';

interface AIArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyActions: (actions: ArchitectAction[]) => void;
}

const AIArchitectModal: React.FC<AIArchitectModalProps> = ({ isOpen, onClose, data, onApplyActions }) => {
  const { nodeTemplates } = useHotel();
  const [activeTab, setActiveTab] = useState<'chat' | 'file' | 'csv'>('chat');
  
  // Chat State
  const [command, setCommand] = useState('');
  
  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV State
  const [targetNodeId, setTargetNodeId] = useState<string>('root');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Common State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposal, setProposal] = useState<ArchitectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Flatten tree for target selection (only containers)
  const containerNodes = useMemo(() => {
      if (!isOpen) return [];
      const nodes: { id: string, name: string, type: string, depth: number }[] = [];
      const traverse = (node: HotelNode, depth: number) => {
          const isContainer = ['root', 'category', 'list', 'menu'].includes(String(node.type));
          if (isContainer) {
              const name = typeof node.name === 'object' ? node.name.tr : node.name;
              nodes.push({ id: node.id, name: String(name), type: String(node.type), depth });
              if (node.children) {
                  node.children.forEach(child => traverse(child, depth + 1));
              }
          }
      };
      traverse(data, 0);
      return nodes;
  }, [data, isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    setCommand('');
    setSelectedFile(null);
    setCsvFile(null);
    setCsvPreview([]);
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

  const handleDownloadSampleCSV = () => {
      if (!selectedTemplateId) {
          setError("Please select a template first.");
          return;
      }
      const template = nodeTemplates.find(t => t.id === selectedTemplateId);
      if (!template) return;

      // 1. Headers
      const headers = ['Name_TR', 'Name_EN', 'Type', 'Intent'];
      const guideRow = [
          '[Örn: Hamburger]', 
          '[Ex: Hamburger]', 
          '[item | menu_item | category | list | menu]', 
          '[informational | request | policy | complaint | safety | navigation]'
      ];

      // 2. Dynamic Fields
      template.fields.forEach(f => {
          const baseHeader = f.label.tr || f.key;
          headers.push(`${baseHeader}_TR`);
          headers.push(`${baseHeader}_EN`);

          // Guide Logic
          let guide = '[Metin]';
          if (f.type === 'boolean') guide = '[true | false]';
          else if (f.type === 'number') guide = '[Sayı]';
          else if (f.type === 'currency') guide = '[100 TL]';
          else if (f.type === 'select' || f.type === 'multiselect') {
             const opts = f.options ? (Array.isArray(f.options) ? f.options : f.options.tr) : [];
             guide = `[${opts.slice(0, 3).join(' | ')}${opts.length > 3 ? '...' : ''}]`;
          }
          else if (f.type === 'date') guide = '[YYYY-MM-DD]';
          else if (f.type === 'time') guide = '[HH:MM]';
          
          guideRow.push(guide); // For TR column
          guideRow.push(guide.replace('Metin', 'Text').replace('Sayı', 'Number')); // For EN column
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, guideRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      // Use .xlsx to ensure correct column parsing in all locales (fixes delimiter issues)
      XLSX.writeFile(wb, `${template.name}_Sample.xlsx`);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setCsvFile(file);
          setError(null);

          // Parse Preview
          const reader = new FileReader();
          reader.onload = (evt) => {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws);
              
              // Filter out guide row for preview if it exists
              const cleanData = data.filter((row: any) => !String(row.Type || '').trim().startsWith('['));
              setCsvPreview(cleanData.slice(0, 5)); // Preview first 5 real rows
          };
          reader.readAsBinaryString(file);
      }
  };

  const handleProcessCSV = async () => {
      if (!csvFile || !selectedTemplateId) return;
      setIsAnalyzing(true);
      setError(null);

      try {
          const template = nodeTemplates.find(t => t.id === selectedTemplateId);
          if (!template) throw new Error("Template not found");

          const reader = new FileReader();
          reader.onload = (evt) => {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const rows: any[] = XLSX.utils.sheet_to_json(ws);

              // Filter out the guide row (heuristic: check if Type starts with '[')
              const cleanRows = rows.filter(row => {
                  const typeVal = row.Type || '';
                  return !String(typeVal).trim().startsWith('[');
              });

              const actions: ArchitectAction[] = cleanRows.map(row => {
                  // 1. Basic Info
                  const nameTR = row.Name_TR || row.Name || 'Yeni Öğe';
                  const nameEN = row.Name_EN || nameTR; // Fallback to TR if EN missing
                  const type = row.Type || 'item';
                  const intent = row.Intent || 'informational';

                  // 2. Attributes from Template
                  const attributes = template.fields.map(field => {
                      const headerBase = field.label.tr || field.key;
                      // Support both new format (_TR/_EN) and legacy/simple format (no suffix)
                      const valTR = row[`${headerBase}_TR`] || row[headerBase] || '';
                      const valEN = row[`${headerBase}_EN`] || ''; 
                      
                      return {
                          id: generateId('attr'),
                          key: { tr: field.label.tr, en: field.label.en },
                          value: { tr: String(valTR), en: String(valEN) },
                          type: field.type,
                          options: field.options ? (Array.isArray(field.options) ? field.options : field.options.tr) : undefined
                      };
                  });

                  return {
                      type: 'add',
                      targetId: targetNodeId,
                      data: {
                          name: { tr: nameTR, en: nameEN },
                          type: type,
                          intent: intent,
                          appliedTemplateId: template.id,
                          attributes: attributes,
                          value: { tr: '', en: '' }, // Empty as requested
                          description: { tr: '', en: '' }, // Empty as requested
                          tags: [] // Empty as requested
                      },
                      reason: `Imported from CSV using template: ${template.name}`
                  };
              });

              setProposal({
                  summary: `Ready to import ${cleanRows.length} items from CSV into selected target.`,
                  actions: actions
              });
              setIsAnalyzing(false);
          };
          reader.readAsBinaryString(csvFile);

      } catch (err) {
          console.error(err);
          setError("Failed to process CSV.");
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
             <button 
                onClick={() => setActiveTab('csv')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'csv' ? 'border-primary-500 text-primary-700 bg-primary-100/50' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}
             >
                <FileSpreadsheet size={16} /> Bulk CSV
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

              {/* CSV TAB CONTENT */}
              {activeTab === 'csv' && (
                  <div className="space-y-6">
                      {/* Step 1: Configuration */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Parent Node</label>
                              <select 
                                  value={targetNodeId} 
                                  onChange={(e) => setTargetNodeId(e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              >
                                  <option value="root">Root (Ana Dizin)</option>
                                  {containerNodes.map(n => (
                                      <option key={n.id} value={n.id}>
                                          {'-'.repeat(n.depth)} {n.name} ({n.type})
                                      </option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Template</label>
                              <select 
                                  value={selectedTemplateId} 
                                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              >
                                  <option value="">-- Select Template --</option>
                                  {nodeTemplates.map(t => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      {/* Step 2: Download Sample */}
                      {selectedTemplateId && (
                          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-center justify-between">
                              <div>
                                  <h4 className="text-sm font-bold text-blue-800">Need a starting point?</h4>
                                  <p className="text-xs text-blue-600 mt-1">Download a CSV template based on your selection.</p>
                              </div>
                              <button 
                                  onClick={handleDownloadSampleCSV}
                                  className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm"
                              >
                                  <Download size={14} /> Download Sample Excel
                              </button>
                          </div>
                      )}

                      {/* Step 3: Upload */}
                      <div 
                        className={`
                          border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                          ${csvFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
                        `}
                        onClick={() => csvInputRef.current?.click()}
                      >
                         <div className={`p-3 rounded-full mb-2 ${csvFile ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {csvFile ? <FileSpreadsheet size={24} /> : <UploadCloud size={24} />}
                         </div>
                         
                         {csvFile ? (
                            <div>
                               <p className="text-sm font-bold text-slate-800">{csvFile.name}</p>
                               <p className="text-xs text-slate-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                         ) : (
                            <div>
                               <p className="text-sm font-bold text-slate-700">Upload Filled Excel / CSV</p>
                               <p className="text-xs text-slate-500 mt-1">Click to browse</p>
                            </div>
                         )}
                         <input 
                            type="file" 
                            ref={csvInputRef} 
                            onChange={handleCsvFileChange} 
                            className="hidden" 
                            accept=".csv, .xlsx, .xls"
                         />
                      </div>

                      {/* Step 4: Preview */}
                      {csvPreview.length > 0 && (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                                  Preview (First 5 Rows)
                              </div>
                              <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                      <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                                          <tr>
                                              {Object.keys(csvPreview[0]).map(k => (
                                                  <th key={k} className="px-3 py-2">{k}</th>
                                              ))}
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {csvPreview.map((row, i) => (
                                              <tr key={i} className="bg-white hover:bg-slate-50">
                                                  {Object.values(row).map((v: any, j) => (
                                                      <td key={j} className="px-3 py-2 text-slate-700">{String(v)}</td>
                                                  ))}
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}

                      <div className="flex justify-end pt-2">
                          <button
                            onClick={handleProcessCSV}
                            disabled={isAnalyzing || !csvFile || !selectedTemplateId}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-emerald-200"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 size={18} className="animate-spin" /> Processing CSV...
                              </>
                            ) : (
                              <>
                                <Check size={18} /> Generate Nodes
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

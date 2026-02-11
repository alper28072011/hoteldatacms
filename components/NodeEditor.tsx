
import React, { useMemo, useState } from 'react';
import { HotelNode, NodeType, NodeAttribute } from '../types';
import { analyzeHotelStats, findPathToNode, generateId } from '../utils/treeUtils';
import { generateNodeContext } from '../services/geminiService';
import { useHotel } from '../contexts/HotelContext';
import { 
  LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  MapPin, Clock, ChevronRight, Database, Copy, Check, Plus, 
  Settings, List, FileText, CircleHelp, X, Calendar, DollarSign, 
  Ticket, CircleAlert, Info, Trash2, Pencil, Save
} from 'lucide-react';

interface NodeEditorProps {
  node: HotelNode | null;
  root: HotelNode;
  onUpdate: (id: string, updates: Partial<HotelNode>) => void;
  onDelete: (id: string) => void;
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// --- REUSABLE UI COMPONENTS ---

const ToggleSwitch = ({ label, checked, onChange, icon: Icon }: { label: string, checked: boolean, onChange: (val: boolean) => void, icon?: any }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className={`text-slate-500 ${checked ? 'text-blue-600' : ''}`} />}
      <span className={`text-sm font-medium ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
    </div>
    <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-5' : ''}`}></div>
    </div>
  </div>
);

const DayPicker = ({ selectedDays, onChange }: { selectedDays: string[] | undefined, onChange: (days: string[]) => void }) => {
  const toggleDay = (day: string) => {
    const current = selectedDays || [];
    if (current.includes(day)) {
      onChange(current.filter(d => d !== day));
    } else {
      onChange([...current, day]);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {DAYS_FULL.map((day, idx) => {
        const isSelected = (selectedDays || []).includes(day);
        return (
          <button
            key={day}
            onClick={() => toggleDay(day)}
            className={`
              w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center transition-all
              ${isSelected ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white border border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500'}
            `}
            title={day}
          >
            {DAYS_SHORT[idx]}
          </button>
        );
      })}
    </div>
  );
};

// --- MAIN COMPONENT ---

const NodeEditor: React.FC<NodeEditorProps> = ({ node, root, onUpdate, onDelete }) => {
  const { addChild, updateNode } = useHotel();
  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Attribute State
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Sub-Content Edit State
  const [editingSubNodeId, setEditingSubNodeId] = useState<string | null>(null);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!node || !root) return [];
    return findPathToNode(root, node.id) || [];
  }, [root, node]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50">
        <div className="bg-white p-6 rounded-full mb-4 shadow-sm border border-slate-100">
            <BrainCircuit size={48} className="opacity-20 text-indigo-500" />
        </div>
        <p className="text-sm font-medium">Select an item from the Explorer to edit</p>
      </div>
    );
  }

  // --- HANDLERS ---
  const handleChange = (field: keyof HotelNode, value: any) => {
    onUpdate(node.id, { [field]: value });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if(window.confirm('Are you sure you want to delete this item?')) {
        onDelete(node.id);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAutoGenerateContext = async () => {
    setIsGeneratingContext(true);
    try {
      const result = await generateNodeContext(node);
      onUpdate(node.id, {
        tags: result.tags,
        description: result.description
      });
    } catch (error) {
      console.error("Failed to auto-generate context", error);
    } finally {
      setIsGeneratingContext(false);
    }
  };

  // Attribute Logic
  const handleAddAttribute = () => {
    if (!newAttrKey.trim()) return;
    const newAttr: NodeAttribute = { id: generateId('attr'), key: newAttrKey, value: newAttrValue, type: 'text' };
    const currentAttributes = node.attributes || [];
    onUpdate(node.id, { attributes: [...currentAttributes, newAttr] });
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleDeleteAttribute = (attrId: string) => {
      onUpdate(node.id, { attributes: (node.attributes || []).filter(a => a.id !== attrId) });
  };

  // Sub-Content Logic
  const subContentNodes = (node.children || []).filter(c => ['qa_pair', 'note'].includes(String(c.type)));
  
  const handleAddSubContent = (type: 'qa_pair' | 'note') => {
      addChild(node.id, type);
  };

  // --- UI RENDERERS ---

  // 1. SMART SUMMARY CHIPS (At a Glance)
  const renderSummaryChips = () => {
    if (node.type === 'category' || node.type === 'root') return null;

    const checks = [];
    
    // Check Location
    if (!node.location) {
        checks.push({ label: 'Add Location', icon: MapPin, color: 'text-amber-600 bg-amber-50 border-amber-200' });
    }
    // Check Schedule
    if (['item', 'event', 'service'].includes(String(node.type))) {
        if (!node.startTime && !node.endTime) {
            checks.push({ label: 'Set Hours', icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-200' });
        }
        if (!node.days || node.days.length === 0) {
            checks.push({ label: 'Select Days', icon: Calendar, color: 'text-violet-600 bg-violet-50 border-violet-200' });
        }
    }
    // Check Price
    if (node.isPaid && !node.price) {
        checks.push({ label: 'Set Price', icon: DollarSign, color: 'text-red-600 bg-red-50 border-red-200' });
    }

    if (checks.length === 0 && !['category', 'root'].includes(String(node.type))) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">
                <Check size={14} /> All Data Complete
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {checks.map((check, idx) => (
                <div key={idx} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${check.color}`}>
                    <check.Icon size={12} /> {check.label}
                </div>
            ))}
        </div>
    );
  };

  // --- SUB-EDITOR MODAL (Inline Edit) ---
  const renderSubNodeEditor = () => {
    if (!editingSubNodeId) return null;
    const subNode = (node.children || []).find(c => c.id === editingSubNodeId);
    if (!subNode) return null;

    const handleSubUpdate = (updates: Partial<HotelNode>) => {
        updateNode(subNode.id, updates);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        {subNode.type === 'qa_pair' ? <CircleHelp size={16} className="text-blue-500"/> : <FileText size={16} className="text-amber-500"/>}
                        {subNode.type === 'qa_pair' ? 'Edit FAQ' : 'Edit Note'}
                    </h3>
                    <button onClick={() => setEditingSubNodeId(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                </div>
                <div className="p-4 space-y-4">
                    {subNode.type === 'qa_pair' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Question</label>
                            <input 
                                type="text" 
                                value={subNode.name || ''}
                                onChange={(e) => handleSubUpdate({ name: e.target.value, question: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {subNode.type === 'qa_pair' ? 'Answer' : 'Content'}
                        </label>
                        <textarea 
                            value={subNode.type === 'qa_pair' ? subNode.answer : subNode.value}
                            onChange={(e) => handleSubUpdate(subNode.type === 'qa_pair' ? { answer: e.target.value } : { value: e.target.value })}
                            rows={5}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={() => updateNode(node.id, {})} /* Hack to trigger delete check in parent? No, just use deleteNode */
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded"
                        onClickCapture={(e) => { e.stopPropagation(); onDelete(subNode.id); setEditingSubNodeId(null); }}
                    >
                        Delete
                    </button>
                    <button onClick={() => setEditingSubNodeId(null)} className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm">
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
  };


  // --- ROOT VIEW ---
  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <LayoutDashboard size={20} className="text-blue-600"/>
               Dashboard
             </h2>
             <div className="text-xs text-slate-400 mt-1">Manage global hotel settings</div>
          </div>
          <div className="text-right">
             <div className="text-sm font-medium text-slate-600">Total Elements</div>
             <div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div>
          </div>
        </div>
        <div className="p-10 flex items-center justify-center text-slate-400">
            <p>Select a node from the left menu to start editing.</p>
        </div>
      </div>
    );
  }

  // --- STANDARD EDITOR VIEW ---
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {renderSubNodeEditor()}

      {/* HEADER */}
      <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 shadow-sm z-20">
        <div className="flex-1 min-w-0 mr-4">
           {/* Breadcrumb Path */}
           <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 font-medium uppercase tracking-wider">
              {breadcrumbs.slice(0, -1).map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span>{crumb.name || 'Untitled'}</span>
                 </React.Fragment>
              ))}
           </div>
           <div className="flex items-center gap-2">
               <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{node.type}</span>
               <h2 className="text-sm font-bold text-slate-800 truncate">{node.name || 'Untitled Node'}</h2>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           <select 
               value={node.type}
               onChange={(e) => handleChange('type', e.target.value)}
               className="text-xs font-bold border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-700 outline-none hover:bg-slate-100 cursor-pointer"
           >
               <option value="category">Folder / Category</option>
               <option value="item">Item / Service</option>
               <option value="event">Event / Activity</option>
               <option value="qa_pair">Q&A Pair</option>
               <option value="note">Internal Note</option>
           </select>
           <div className="h-6 w-px bg-slate-200 mx-1"></div>
           <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
               <Trash2 size={16} />
           </button>
        </div>
      </div>

      {/* SCROLLABLE BODY */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
        
        {/* AT A GLANCE (Summary) */}
        {['item', 'event', 'service'].includes(String(node.type)) && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between animate-in slide-in-from-top-2">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">At a Glance</h3>
                    {renderSummaryChips()}
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-400">Unique ID</div>
                    <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded cursor-pointer hover:bg-slate-200" onClick={() => handleCopyId(node.id)}>
                        {node.id}
                    </code>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* CARD 1: BASIC INFO */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">Basic Information</h3>
                </div>
                <div className="p-5 space-y-4 flex-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name / Title</label>
                        <input 
                            type="text" 
                            value={node.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-base font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none placeholder:font-normal"
                            placeholder="e.g. Main Pool"
                        />
                    </div>
                    {/* Value Field (Conditional) */}
                    {['qa_pair', 'note', 'field'].includes(String(node.type)) && (
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {node.type === 'qa_pair' ? 'Answer' : 'Content'}
                            </label>
                            <textarea 
                                value={node.type === 'qa_pair' ? node.answer : node.value}
                                onChange={(e) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', e.target.value)}
                                rows={4}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}
                    {/* Description for Items/Categories */}
                    {!['qa_pair', 'note', 'field'].includes(String(node.type)) && (
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description / Notes</label>
                            <textarea 
                                value={node.description || ''}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={3}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 placeholder:text-slate-300"
                                placeholder="Details about this item..."
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* CARD 2: SCHEDULE & TIMING (Conditional) */}
            {['item', 'event', 'service', 'category'].includes(String(node.type)) && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                        <Clock size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-700">Schedule & Availability</h3>
                    </div>
                    <div className="p-5 space-y-5 flex-1">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Operation Days</label>
                            <DayPicker selectedDays={node.days} onChange={(days) => handleChange('days', days)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Open / Start</label>
                                <input 
                                    type="time" 
                                    value={node.startTime || ''}
                                    onChange={(e) => handleChange('startTime', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Close / End</label>
                                <input 
                                    type="time" 
                                    value={node.endTime || ''}
                                    onChange={(e) => handleChange('endTime', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CARD 3: LOGISTICS & ACCESS (Conditional) */}
            {['item', 'event', 'service'].includes(String(node.type)) && (
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-500" />
                        <h3 className="text-sm font-bold text-slate-700">Location & Access Rules</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                             <div className="relative">
                                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="text" 
                                    value={node.location || ''}
                                    onChange={(e) => handleChange('location', e.target.value)}
                                    placeholder="e.g. Lobby Floor, Next to Pool"
                                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                             </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2">
                             <ToggleSwitch 
                                label="Is Paid Service?" 
                                checked={!!node.isPaid} 
                                onChange={(val) => handleChange('isPaid', val)} 
                                icon={DollarSign}
                             />
                             <ToggleSwitch 
                                label="Reserv. Required?" 
                                checked={!!node.requiresReservation} 
                                onChange={(val) => handleChange('requiresReservation', val)} 
                                icon={Ticket}
                             />
                        </div>

                        {node.isPaid && (
                             <div className="animate-in slide-in-from-top-1 fade-in">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price / Cost</label>
                                 <input 
                                    type="text" 
                                    value={node.price || ''}
                                    onChange={(e) => handleChange('price', e.target.value)}
                                    placeholder="e.g. $50 per person"
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                             </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Age Restriction</label>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="number" 
                                    value={node.minAge || ''}
                                    onChange={(e) => handleChange('minAge', e.target.value)}
                                    placeholder="Min Age"
                                    className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                />
                                <span className="text-slate-400 text-xs font-bold">TO</span>
                                <input 
                                    type="number" 
                                    value={node.maxAge || ''}
                                    onChange={(e) => handleChange('maxAge', e.target.value)}
                                    placeholder="Max Age"
                                    className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CARD 4: FAQS & NOTES (Inline Management) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col xl:col-span-2">
                 <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CircleHelp size={16} className="text-violet-500" />
                        <h3 className="text-sm font-bold text-slate-700">Detailed Information & FAQs</h3>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={() => handleAddSubContent('qa_pair')} className="text-[10px] font-bold bg-white border border-slate-200 hover:border-violet-400 hover:text-violet-600 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                            <Plus size={12} /> Add FAQ
                        </button>
                        <button onClick={() => handleAddSubContent('note')} className="text-[10px] font-bold bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-600 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                            <Plus size={12} /> Add Note
                        </button>
                    </div>
                </div>
                <div className="p-2">
                    {subContentNodes.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            No FAQs or specific notes added. Add one to help the AI.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                             {subContentNodes.map(sub => (
                                 <div 
                                    key={sub.id} 
                                    onClick={() => setEditingSubNodeId(sub.id)}
                                    className="group flex items-start gap-3 p-3 bg-white border border-slate-100 hover:border-blue-300 hover:shadow-md rounded-lg cursor-pointer transition-all"
                                 >
                                     <div className={`mt-0.5 ${sub.type === 'qa_pair' ? 'text-violet-500' : 'text-amber-500'}`}>
                                         {sub.type === 'qa_pair' ? <CircleHelp size={16}/> : <FileText size={16}/>}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="flex justify-between">
                                            <span className="text-xs font-bold text-slate-700 truncate block pr-2">
                                                {sub.type === 'qa_pair' ? (sub.name || 'New Question') : (sub.name || 'New Note')}
                                            </span>
                                            <Pencil size={12} className="text-slate-300 opacity-0 group-hover:opacity-100"/>
                                         </div>
                                         <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                             {sub.type === 'qa_pair' ? (sub.answer || 'No answer set...') : (sub.value || 'No content...')}
                                         </p>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>

            {/* CARD 5: DYNAMIC ATTRIBUTES (Extras) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col xl:col-span-2">
                 <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <List size={16} className="text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">Extra Properties (Custom)</h3>
                </div>
                <div className="p-5">
                     <div className="space-y-3 mb-4">
                        {node.attributes && node.attributes.map(attr => (
                            <div key={attr.id} className="flex items-center gap-3">
                                <div className="w-1/3 text-right text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1.5 rounded">{attr.key}</div>
                                <div className="flex-1 text-sm text-slate-800 border-b border-slate-100 py-1.5">{attr.value}</div>
                                <button onClick={() => handleDeleteAttribute(attr.id)} className="text-slate-300 hover:text-red-500"><X size={14}/></button>
                            </div>
                        ))}
                     </div>
                     <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <input 
                            type="text" 
                            value={newAttrKey}
                            onChange={(e) => setNewAttrKey(e.target.value)}
                            placeholder="Property Name (e.g. Dress Code)"
                            className="w-1/3 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-2 outline-none focus:border-blue-400"
                        />
                        <input 
                            type="text" 
                            value={newAttrValue}
                            onChange={(e) => setNewAttrValue(e.target.value)}
                            placeholder="Value"
                            className="flex-1 text-sm border border-slate-200 rounded px-3 py-2 outline-none focus:border-blue-400"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                        />
                        <button onClick={handleAddAttribute} disabled={!newAttrKey.trim()} className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded">
                            <Plus size={16} />
                        </button>
                     </div>
                </div>
            </div>

            {/* CARD 6: AI METADATA (Hidden/Advanced) */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 border-dashed xl:col-span-2">
                 <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Sparkles size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">AI Instructions</span>
                    </div>
                    <button onClick={handleAutoGenerateContext} disabled={isGeneratingContext} className="text-[10px] font-bold text-violet-600 hover:bg-violet-100 px-2 py-1 rounded transition-colors flex items-center gap-1">
                        {isGeneratingContext ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10} />} Auto-Tag
                    </button>
                 </div>
                 <div className="flex gap-4">
                     <div className="flex-1">
                         <textarea 
                            value={node.tags ? node.tags.join(', ') : ''}
                            onChange={(e) => handleChange('tags', e.target.value.split(',').map(s => s.trim()))}
                            rows={1}
                            className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs outline-none"
                            placeholder="Tags: vip, summer, outdoor..."
                        />
                     </div>
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default NodeEditor;

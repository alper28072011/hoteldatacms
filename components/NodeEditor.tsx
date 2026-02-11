
import React, { useMemo, useState } from 'react';
import { HotelNode, NodeType } from '../types';
import { analyzeHotelStats, findPathToNode } from '../utils/treeUtils';
import { generateNodeContext } from '../services/geminiService';
import { 
  Tag, 
  Calendar, 
  DollarSign, 
  Clock, 
  Trash2, 
  Info, 
  Layers, 
  Type, 
  List, 
  ShieldAlert, 
  CheckCircle2, 
  LayoutDashboard,
  Box,
  BrainCircuit,
  Hash,
  Sparkles,
  Loader2,
  Eye,
  FileText,
  MapPin,
  Users,
  Repeat,
  Ban,
  ChevronRight,
  Fingerprint,
  Database,
  Copy,
  Check
} from 'lucide-react';

interface NodeEditorProps {
  node: HotelNode | null;
  root: HotelNode;
  onUpdate: (id: string, updates: Partial<HotelNode>) => void;
  onDelete: (id: string) => void;
}

// Helper for type descriptions
const getTypeInfo = (type: string) => {
  switch (type) {
    case 'category': return { label: 'Category', desc: 'A structural folder to organize related items (e.g., "Rooms", "Dining"). Does not usually hold a direct value.', icon: <Layers size={14} /> };
    case 'field': return { label: 'Field', desc: 'A single data point containing specific text (e.g., "WiFi Password", "Check-in Time").', icon: <Type size={14} /> };
    case 'item': return { label: 'Item', desc: 'A tangible object or service entity (e.g., "Pool", "Gym").', icon: <Box size={14} /> };
    case 'list': return { label: 'List', desc: 'A collection container for similar items (e.g., "Rules List", "Amenities List").', icon: <List size={14} /> };
    case 'menu': return { label: 'Menu', desc: 'Specific for restaurant or spa menus.', icon: <List size={14} /> };
    case 'menu_item': return { label: 'Menu Item', desc: 'A specific item within a menu (e.g., "Burger", "Massage").', icon: <Box size={14} /> };
    case 'event': return { label: 'Event / Activity', desc: 'Scheduled activities, shows, or clubs with recurrence logic (Daily, Bi-Weekly, etc.).', icon: <Calendar size={14} /> };
    case 'qa_pair': return { label: 'Q&A', desc: 'A direct Question and Answer pair for the chatbot.', icon: <Info size={14} /> };
    default: return { label: type, desc: 'Generic data node.', icon: <Box size={14} /> };
  }
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// --- RECURSIVE DOCUMENT RENDERER ---
const DocumentRenderer: React.FC<{ node: HotelNode; depth?: number }> = ({ node, depth = 0 }) => {
  const hasChildren = node.children && node.children.length > 0;
  
  const renderContent = () => {
    // 1. ROOT LEVEL (H1)
    if (depth === 0) {
      return (
        <div className="mb-8">
           <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{node.name}</h1>
           {node.description && <p className="text-slate-500 text-lg leading-relaxed max-w-2xl">{node.description}</p>}
        </div>
      );
    }

    // 2. CATEGORY LEVEL 1 (H2)
    if (node.type === 'category' && depth === 1) {
      return (
        <div className="mt-10 mb-6 border-b border-slate-200 pb-2">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {node.name}
          </h2>
        </div>
      );
    }

    // 3. EVENT RENDERING (New & Detailed)
    if (node.type === 'event') {
        return (
            <div className={`p-4 mb-3 border rounded-lg hover:shadow-md transition-shadow ${node.eventStatus === 'cancelled' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className={`font-bold text-lg ${node.eventStatus === 'cancelled' ? 'text-red-700 line-through' : 'text-slate-800'}`}>
                            {node.name}
                        </h4>
                        {node.eventStatus === 'cancelled' && <span className="text-xs font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded">CANCELLED</span>}
                        
                        <div className="flex flex-wrap gap-2 mt-2 text-sm text-slate-600">
                             {node.location && (
                                 <span className="flex items-center gap-1"><MapPin size={12}/> {node.location}</span>
                             )}
                             {(node.startTime || node.endTime) && (
                                 <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded"><Clock size={12}/> {node.startTime} - {node.endTime}</span>
                             )}
                        </div>

                        {/* Schedule Logic Display */}
                        <div className="mt-2 text-xs text-slate-500 font-mono">
                            {node.recurrenceType === 'biweekly' && <span className="text-indigo-600 font-bold">Bi-Weekly</span>}
                            {node.recurrenceType === 'weekly' && <span className="text-blue-600 font-bold">Weekly</span>}
                            {node.recurrenceType === 'daily' && <span className="text-green-600 font-bold">Daily</span>}
                            
                            {node.days && node.days.length > 0 && ` on ${node.days.join(', ')}`}
                            {node.validFrom && ` (${node.validFrom} to ${node.validUntil || 'indefinite'})`}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {node.targetAudience && node.targetAudience !== 'all' && (
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase
                                ${node.targetAudience === 'kids' ? 'bg-orange-100 text-orange-600' : 
                                  node.targetAudience === 'adults' ? 'bg-slate-800 text-white' : 'bg-blue-100 text-blue-600'}
                            `}>
                                {node.targetAudience}
                            </span>
                        )}
                        {node.isPaid && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">PAID</span>}
                    </div>
                </div>
            </div>
        )
    }

    // 4. SUB-CATEGORIES
    if ((node.type === 'category' || node.type === 'list' || node.type === 'menu') && depth > 1) {
      return (
        <div className="mt-6 mb-3">
          <h3 className={`font-bold text-slate-700 ${depth === 2 ? 'text-lg' : 'text-md'}`}>
            {node.name}
          </h3>
          {node.type === 'menu' && <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Menu Selection</div>}
        </div>
      );
    }

    // 5. MENU ITEMS
    if (node.type === 'menu_item') {
      return (
        <div className="flex justify-between items-baseline py-2 border-b border-dashed border-slate-100 group hover:bg-slate-50 px-2 rounded transition-colors">
           <div className="flex-1">
              <span className="font-semibold text-slate-700">{node.name}</span>
              {node.description && <span className="text-xs text-slate-500 ml-2">- {node.description}</span>}
              {node.tags && node.tags.length > 0 && (
                 <div className="flex gap-1 mt-1">
                   {node.tags.map(t => <span key={t} className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded">{t}</span>)}
                 </div>
              )}
           </div>
           <div className="flex items-baseline pl-4">
              {node.calories && <span className="text-xs text-slate-400 mr-3 italic">{node.calories} kcal</span>}
              <span className="font-bold text-slate-800">{node.price ? `$${node.price}` : 'Free'}</span>
           </div>
        </div>
      );
    }

    // 6. STANDARD FIELDS / ITEMS
    if (node.type === 'field' || node.type === 'item') {
       if (!node.value && !node.name) return null;
       return (
         <div className="py-2 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-4 hover:bg-slate-50 rounded px-2 transition-colors">
            <div className="text-sm font-semibold text-slate-500 flex items-center gap-2">
              {node.name}
              {node.isPaid && <DollarSign size={10} className="text-emerald-500" />}
              {node.isMandatory && <ShieldAlert size={10} className="text-amber-500" />}
            </div>
            <div className="text-sm text-slate-800 font-medium leading-relaxed">
               {node.value || <span className="text-slate-300 italic">Not set</span>}
               {(node.startTime || node.endTime) && (
                  <span className="inline-flex items-center gap-1 ml-3 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                     <Clock size={10}/> {node.startTime} - {node.endTime}
                  </span>
               )}
            </div>
         </div>
       );
    }

    // 7. Q&A PAIRS
    if (node.type === 'qa_pair') {
      return (
        <div className="bg-slate-50 p-3 rounded-lg my-2 border border-slate-100">
           <div className="text-sm font-bold text-slate-700 mb-1">Q: {node.question}</div>
           <div className="text-sm text-slate-600 italic">A: {node.answer}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={depth > 0 ? "ml-0" : ""}>
       {renderContent()}
       {hasChildren && (
         <div className={depth >= 1 && node.type !== 'menu' && node.type !== 'list' ? "ml-2 md:ml-4" : ""}>
            {node.children!.map(child => (
              <DocumentRenderer key={child.id} node={child} depth={depth + 1} />
            ))}
         </div>
       )}
    </div>
  );
};

const NodeEditor: React.FC<NodeEditorProps> = ({ node, root, onUpdate, onDelete }) => {
  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  const typeInfo = node ? getTypeInfo(String(node.type)) : { label: '', desc: '', icon: null };
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Breadcrumbs Calculation
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

  const handleChange = (field: keyof HotelNode, value: any) => {
    onUpdate(node.id, { [field]: value });
  };

  const handleDayToggle = (day: string) => {
      const currentDays = node.days || [];
      if (currentDays.includes(day)) {
          handleChange('days', currentDays.filter(d => d !== day));
      } else {
          handleChange('days', [...currentDays, day]);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(node.id);
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

  // --- ROOT DASHBOARD VIEW ---
  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <LayoutDashboard size={20} className="text-blue-600"/>
               Dashboard & Preview
             </h2>
             <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">ROOT</span>
             </div>
          </div>
          <div className="text-right">
             <div className="text-sm font-medium text-slate-600">Total Elements</div>
             <div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
           <div className="max-w-5xl mx-auto space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Categories</div>
                    <div className="text-2xl font-bold text-slate-800">{stats?.categories}</div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Data Fields</div>
                    <div className="text-2xl font-bold text-slate-800">{stats?.fillableItems}</div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Empty Fields</div>
                    <div className={`text-2xl font-bold ${stats?.emptyItems && stats.emptyItems > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{stats?.emptyItems}</div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Depth</div>
                    <div className="text-2xl font-bold text-slate-800">{stats?.depth}</div>
                 </div>
              </div>

              {/* Document Preview */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Eye size={18} className="text-violet-500"/> Content Preview
                    </h3>
                    <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">Live View</div>
                 </div>
                 <div className="bg-white rounded-lg shadow-xl border border-slate-200 min-h-[600px] p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500"></div>
                    <div className="prose prose-slate max-w-none">
                       <DocumentRenderer node={node} />
                    </div>
                 </div>
              </div>
              
              {/* Root Metadata */}
              <div className="border-t border-slate-200 pt-8 mt-4 pb-8">
                  <div className="flex items-center gap-2 text-slate-400 mb-4">
                      <Database size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">System Metadata</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-100/50 p-4 rounded-lg border border-slate-200/60">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unique ID</label>
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleCopyId(node.id)}>
                             <code className="text-xs font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">{node.id}</code>
                             {copiedId === node.id ? <Check size={12} className="text-emerald-500"/> : <Copy size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Node Type</label>
                          <span className="text-xs text-slate-600 font-medium capitalize">{node.type}</span>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // --- EDITOR VIEW ---
  return (
    <div className="h-full flex flex-col bg-white">
      
      {/* HEADER */}
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4">
           {/* Breadcrumb Path */}
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
              {breadcrumbs.map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span className={i === breadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500 hover:text-blue-600 transition-colors cursor-default"}>
                       {crumb.name || 'Untitled'}
                    </span>
                 </React.Fragment>
              ))}
           </div>

           <h2 className="text-lg font-bold text-slate-800 truncate leading-none pb-0.5">
              {node.name || 'Untitled Node'}
           </h2>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex flex-col items-end">
              <select 
                  value={node.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="text-xs font-bold uppercase tracking-wide border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer text-right appearance-none pl-6"
              >
                  <option value="category">Category</option>
                  <option value="event">Event / Activity</option>
                  <option value="item">Item</option>
                  <option value="field">Field</option>
                  <option value="list">List</option>
                  <option value="menu">Menu</option>
                  <option value="menu_item">Menu Item</option>
                  <option value="qa_pair">Q&A</option>
                  <option value="policy">Policy</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1">{typeInfo.label} Node</span>
           </div>
           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           <button 
               type="button"
               onClick={handleDeleteClick}
               className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
           >
               <Trash2 size={18} />
           </button>
        </div>
      </div>

      {/* EDITOR BODY */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-8">
            
            {/* 1. MAIN IDENTITY */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-start gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <div className="text-blue-500 mt-0.5">{typeInfo.icon}</div>
                    <div>
                        <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">Node Type: {typeInfo.label}</div>
                        <div className="text-xs text-blue-600/80 leading-relaxed">{typeInfo.desc}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title / Name</label>
                        <input 
                            type="text" 
                            value={node.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full bg-white text-lg font-medium text-slate-900 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300"
                            placeholder={node.type === 'event' ? "e.g. Morning Yoga, Live Jazz Night" : "e.g. WiFi Password"}
                        />
                    </div>

                    {/* Value Input (Hidden for Events/Categories) */}
                    {node.type !== 'category' && node.type !== 'list' && node.type !== 'event' && (
                        <div>
                             <textarea 
                                value={node.value || ''}
                                onChange={(e) => handleChange('value', e.target.value)}
                                rows={4}
                                className="w-full bg-white text-slate-800 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y placeholder:text-slate-400 leading-relaxed"
                                placeholder="Enter the factual data here..."
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 2. EVENT SCHEDULER (Only for 'event' type) */}
            {node.type === 'event' && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                        <Calendar size={18} className="text-indigo-600" />
                        <h3 className="text-base font-bold text-slate-800">Event Scheduler & Organizer</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Col: Recurrence */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recurrence Pattern</label>
                                <select
                                    value={node.recurrenceType || 'weekly'}
                                    onChange={(e) => handleChange('recurrenceType', e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="daily">Daily (Every Day)</option>
                                    <option value="weekly">Weekly (Specific Days)</option>
                                    <option value="biweekly">Bi-Weekly (Every 2 Weeks)</option>
                                    <option value="specific_date">One Time Only</option>
                                </select>
                            </div>

                            {/* Date Range - Crucial for Bi-Weekly calculation */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valid From (Start)</label>
                                    <input 
                                        type="date" 
                                        value={node.validFrom || ''} 
                                        onChange={(e) => handleChange('validFrom', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700"
                                    />
                                    {node.recurrenceType === 'biweekly' && <p className="text-[10px] text-indigo-500 mt-1">Anchor date for even/odd week calculation.</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valid Until (End)</label>
                                    <input 
                                        type="date" 
                                        value={node.validUntil || ''} 
                                        onChange={(e) => handleChange('validUntil', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700"
                                    />
                                </div>
                            </div>

                            {/* Days Selector */}
                            {node.recurrenceType !== 'specific_date' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS_OF_WEEK.map(day => {
                                            const isActive = (node.days || []).includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    onClick={() => handleDayToggle(day)}
                                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                                        isActive 
                                                        ? 'bg-indigo-600 text-white shadow-md' 
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {day.slice(0, 3)}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={node.startTime || ''} 
                                        onChange={(e) => handleChange('startTime', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time</label>
                                    <input 
                                        type="time" 
                                        value={node.endTime || ''} 
                                        onChange={(e) => handleChange('endTime', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Logistics & Audience */}
                        <div className="space-y-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Event Status</label>
                                <div className="flex gap-2">
                                     {['active', 'cancelled', 'postponed'].map(status => (
                                         <button
                                            key={status}
                                            onClick={() => handleChange('eventStatus', status)}
                                            className={`flex-1 py-2 text-xs font-bold uppercase rounded border ${
                                                node.eventStatus === status 
                                                ? (status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300')
                                                : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'
                                            }`}
                                         >
                                             {status}
                                         </button>
                                     ))}
                                </div>
                             </div>

                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location / Venue</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        value={node.location || ''} 
                                        onChange={(e) => handleChange('location', e.target.value)}
                                        placeholder="e.g. Amphitheater, Kids Club"
                                        className="w-full bg-white pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                             </div>

                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Audience</label>
                                <select
                                    value={node.targetAudience || 'all'}
                                    onChange={(e) => handleChange('targetAudience', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                >
                                    <option value="all">Everyone / Family</option>
                                    <option value="adults">Adults Only (18+)</option>
                                    <option value="kids">Kids (4-12)</option>
                                    <option value="teens">Teens (13-17)</option>
                                    <option value="couples">Couples</option>
                                </select>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Min Age</label>
                                    <input type="number" value={node.minAge || ''} onChange={(e) => handleChange('minAge', parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm"/>
                                 </div>
                                 <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Max Age</label>
                                    <input type="number" value={node.maxAge || ''} onChange={(e) => handleChange('maxAge', parseInt(e.target.value))} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm"/>
                                 </div>
                             </div>
                             
                             <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={!!node.isExternalAllowed}
                                    onChange={(e) => handleChange('isExternalAllowed', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                <span className="text-sm text-slate-600">Open to external guests</span>
                             </div>

                        </div>
                    </div>
                </div>
            )}

            {/* 3. CONTEXT & TAGS (Shared) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Tag size={16} className="text-violet-500"/>
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Semantic Tags</h3>
                        </div>
                        <button 
                            onClick={handleAutoGenerateContext}
                            disabled={isGeneratingContext}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                            {isGeneratingContext ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />}
                            Auto-Generate
                        </button>
                    </div>
                    <div className="mt-auto">
                        <input 
                            type="text" 
                            value={(node.tags || []).join(', ')} 
                            onChange={(e) => handleChange('tags', e.target.value.split(',').map(s => s.trim()))}
                            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g. Fun, Outdoor, Music"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Internal Notes / AI Instructions
                    </label>
                    <textarea 
                        value={node.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 outline-none text-slate-600 italic placeholder:text-slate-300"
                        placeholder="Details about the event recurrence logic or special conditions..."
                    />
                </div>
            </div>
            
            {/* 4. METADATA FOOTER (New) */}
            <div className="border-t border-slate-200 pt-8 mt-4 pb-8">
                <div className="flex items-center gap-2 text-slate-400 mb-4">
                    <Database size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">System Metadata</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-100/50 p-4 rounded-lg border border-slate-200/60">
                    <div className="col-span-1 md:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unique ID</label>
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleCopyId(node.id)}>
                           <code className="text-xs font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 w-full truncate">{node.id}</code>
                           {copiedId === node.id ? <Check size={12} className="text-emerald-500 shrink-0"/> : <Copy size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"/>}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Node Type</label>
                        <span className="text-xs text-slate-600 font-medium capitalize flex items-center gap-1">
                           <Fingerprint size={12} className="opacity-50"/> {node.type}
                        </span>
                    </div>
                    {node.type === 'event' && node.validFrom && (
                         <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Season Start</label>
                            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded inline-block border border-indigo-100">{node.validFrom}</span>
                         </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default NodeEditor;

import React, { useMemo, useState, useEffect } from 'react';
import { HotelNode, NodeType, NodeAttribute, SchemaType, EventData, DiningData, RoomData } from '../types';
import { analyzeHotelStats, findPathToNode, generateId } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes } from '../services/geminiService';
import { validateNodeInput } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, Trash2, LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  ChevronRight, Database, Check, Settings, List, FileText, CircleHelp, 
  X, FolderOpen, Info, TriangleAlert, Wand2, Calendar, Utensils, BedDouble, Clock, Users, DollarSign
} from 'lucide-react';

// --- SUB-COMPONENTS FOR SCHEMAS ---

const EventForm: React.FC<{ data: EventData, onChange: (d: EventData) => void }> = ({ data, onChange }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const toggleDay = (day: string) => {
    const current = data.days || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    onChange({ ...data, days: updated });
  };

  return (
    <div className="space-y-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
       <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2"><Calendar size={16}/> Event Schedule & Rules</h4>
       
       {/* Days */}
       <div>
         <label className="text-xs font-bold text-slate-500 uppercase">Days Active</label>
         <div className="flex gap-2 mt-1">
            {days.map(day => (
              <button 
                key={day} 
                onClick={() => toggleDay(day)}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${data.days?.includes(day) ? 'bg-purple-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500'}`}
              >
                {day.charAt(0)}
              </button>
            ))}
         </div>
       </div>

       {/* Time */}
       <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
            <input type="time" value={data.startTime || ''} onChange={e => onChange({...data, startTime: e.target.value})} className="w-full mt-1 border border-purple-200 rounded px-2 py-1.5 text-sm"/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
            <input type="time" value={data.endTime || ''} onChange={e => onChange({...data, endTime: e.target.value})} className="w-full mt-1 border border-purple-200 rounded px-2 py-1.5 text-sm"/>
          </div>
       </div>

       {/* Age */}
       <div>
          <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
            <span>Target Age Range</span>
            <span className="text-purple-600">{data.ageMin || 0} - {data.ageMax || 99} yrs</span>
          </label>
          <div className="flex gap-4 items-center mt-1">
             <input type="number" placeholder="Min" value={data.ageMin} onChange={e => onChange({...data, ageMin: parseInt(e.target.value)})} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm"/>
             <span className="text-slate-400">-</span>
             <input type="number" placeholder="Max" value={data.ageMax} onChange={e => onChange({...data, ageMax: parseInt(e.target.value)})} className="w-20 border border-slate-200 rounded px-2 py-1 text-sm"/>
          </div>
       </div>

       {/* Price */}
       <div className="flex items-center gap-4 border-t border-purple-200 pt-3">
           <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
             <input type="checkbox" checked={data.isPaid} onChange={e => onChange({...data, isPaid: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500"/>
             Paid Event
           </label>
           {data.isPaid && (
              <input type="text" placeholder="Price (e.g. 20$)" value={data.price || ''} onChange={e => onChange({...data, price: e.target.value})} className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm"/>
           )}
       </div>
    </div>
  );
};

const DiningForm: React.FC<{ data: DiningData, onChange: (d: DiningData) => void }> = ({ data, onChange }) => {
    return (
        <div className="space-y-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
            <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2"><Utensils size={16}/> Restaurant Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Cuisine</label>
                    <input type="text" value={data.cuisine || ''} onChange={e => onChange({...data, cuisine: e.target.value})} placeholder="e.g. Italian" className="w-full mt-1 border border-orange-200 rounded px-2 py-1.5 text-sm"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Dress Code</label>
                    <select value={data.dressCode || ''} onChange={e => onChange({...data, dressCode: e.target.value})} className="w-full mt-1 border border-orange-200 rounded px-2 py-1.5 text-sm bg-white">
                        <option value="Casual">Casual</option>
                        <option value="Smart Casual">Smart Casual</option>
                        <option value="Formal">Formal</option>
                        <option value="Beachwear">Beachwear</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Opens</label>
                    <input type="time" value={data.openingTime || ''} onChange={e => onChange({...data, openingTime: e.target.value})} className="w-full mt-1 border border-orange-200 rounded px-2 py-1.5 text-sm"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Closes</label>
                    <input type="time" value={data.closingTime || ''} onChange={e => onChange({...data, closingTime: e.target.value})} className="w-full mt-1 border border-orange-200 rounded px-2 py-1.5 text-sm"/>
                </div>
            </div>
            
            <div className="flex gap-4 border-t border-orange-200 pt-3">
                 <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="checkbox" checked={data.reservationRequired} onChange={e => onChange({...data, reservationRequired: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500"/>
                    Reservation Required
                 </label>
            </div>
        </div>
    );
};

const RoomForm: React.FC<{ data: RoomData, onChange: (d: RoomData) => void }> = ({ data, onChange }) => {
    return (
        <div className="space-y-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
             <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><BedDouble size={16}/> Room Specs</h4>
             
             <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Size (m²)</label>
                    <input type="number" value={data.sizeSqM || ''} onChange={e => onChange({...data, sizeSqM: parseFloat(e.target.value)})} className="w-full mt-1 border border-indigo-200 rounded px-2 py-1.5 text-sm"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Occupancy</label>
                    <input type="number" value={data.maxOccupancy || ''} onChange={e => onChange({...data, maxOccupancy: parseInt(e.target.value)})} className="w-full mt-1 border border-indigo-200 rounded px-2 py-1.5 text-sm"/>
                </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Bed Type</label>
                    <select value={data.bedType || ''} onChange={e => onChange({...data, bedType: e.target.value})} className="w-full mt-1 border border-indigo-200 rounded px-2 py-1.5 text-sm bg-white">
                        <option value="King">King</option>
                        <option value="Queen">Queen</option>
                        <option value="Twin">Twin</option>
                        <option value="Double">Double</option>
                    </select>
                </div>
             </div>

             <div>
                <label className="text-xs font-bold text-slate-500 uppercase">View</label>
                <input type="text" value={data.view || ''} onChange={e => onChange({...data, view: e.target.value})} placeholder="Sea, Garden, Land..." className="w-full mt-1 border border-indigo-200 rounded px-2 py-1.5 text-sm"/>
             </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export interface NodeEditorProps {
  node: HotelNode;
  root: HotelNode;
  onUpdate: (nodeId: string, updates: Partial<HotelNode>) => void;
  onDelete: (nodeId: string) => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, root, onUpdate, onDelete }) => {
  const { addChild } = useHotel();
  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isGeneratingValue, setIsGeneratingValue] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  // Default empty objects for schemas
  const defaultEvent: EventData = { scheduleType: 'weekly', days: [], startTime: '09:00', endTime: '18:00', location: '', ageMin: 0, ageMax: 99, isPaid: false, requiresReservation: false };
  const defaultDining: DiningData = { cuisine: '', mealType: [], openingTime: '18:00', closingTime: '22:00', dressCode: 'Casual', reservationRequired: false, isPaid: true };
  const defaultRoom: RoomData = { sizeSqM: 30, bedType: 'King', maxOccupancy: 2, view: '', hasBalcony: true, amenities: [] };

  useEffect(() => {
    setNewAttrKey('');
    setNewAttrValue('');
    setValidationError(null);
  }, [node?.id]);

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
    const potentialNode = { ...node, [field]: value };
    const error = validateNodeInput(potentialNode);
    setValidationError(error);
    onUpdate(node.id, { [field]: value });
  };

  const handleSchemaChange = (schema: SchemaType) => {
     let newData: any = {};
     if (schema === 'event') newData = defaultEvent;
     else if (schema === 'dining') newData = defaultDining;
     else if (schema === 'room') newData = defaultRoom;
     else newData = {}; // Generic

     onUpdate(node.id, { schemaType: schema, data: newData });
  };

  const handleDataUpdate = (newData: any) => {
      onUpdate(node.id, { data: newData });
      // Optional: Auto-generate the 'value' summary string so the tree view looks nice
      // This keeps the "human readable" part in sync with the "structured" part
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
      const pathString = breadcrumbs.map(b => b.name || 'Untitled').join(' > ');
      const result = await generateNodeContext(node, pathString);
      const currentTags = node.tags || [];
      const newTags = result.tags || [];
      const mergedTags = Array.from(new Set([...currentTags, ...newTags]));
      onUpdate(node.id, { tags: mergedTags, description: result.description });
    } catch (error) { console.error(error); } finally { setIsGeneratingContext(false); }
  };

  const handleAutoGenerateValue = async () => {
    if (!node.attributes || node.attributes.length === 0) {
        alert("Add some attributes first.");
        return;
    }
    setIsGeneratingValue(true);
    try {
        const generatedText = await generateValueFromAttributes(node.name || '', node.attributes);
        onUpdate(node.id, { value: generatedText });
    } catch (e) { console.error(e); } finally { setIsGeneratingValue(false); }
  };

  const handleAddAttribute = () => {
    if (!newAttrKey.trim()) return;
    const newAttr: NodeAttribute = { id: generateId('attr'), key: newAttrKey.trim(), value: newAttrValue, type: 'text' };
    const currentAttributes = Array.isArray(node.attributes) ? [...node.attributes] : [];
    onUpdate(node.id, { attributes: [...currentAttributes, newAttr] });
    setNewAttrKey(''); setNewAttrValue('');
  };

  const handleUpdateAttribute = (attrId: string, field: keyof NodeAttribute, value: string) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      const updated = currentAttributes.map(a => a.id === attrId ? { ...a, [field]: value } : a);
      onUpdate(node.id, { attributes: updated });
  };

  const handleDeleteAttribute = (attrId: string) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      onUpdate(node.id, { attributes: currentAttributes.filter(a => a.id !== attrId) });
  };

  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard size={20} className="text-blue-600"/> Dashboard</h2>
             <div className="flex items-center gap-3 text-xs text-slate-400 mt-1"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">ROOT</span></div>
          </div>
          <div className="text-right">
             <div className="text-sm font-medium text-slate-600">Total Elements</div>
             <div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div>
          </div>
        </div>
        <div className="p-10 flex items-center justify-center text-slate-400"><p>Select an item to edit.</p></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* HEADER */}
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4">
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
              {breadcrumbs.map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span className={i === breadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500"}>{crumb.name || 'Untitled'}</span>
                 </React.Fragment>
              ))}
           </div>
           <h2 className="text-lg font-bold text-slate-800 truncate leading-none pb-0.5">{node.name || 'Untitled Node'}</h2>
        </div>
        
        <div className="flex items-center gap-3">
           {/* TYPE SELECTOR */}
           <div className="flex flex-col items-end">
              <select value={node.type} onChange={(e) => handleChange('type', e.target.value)} className="text-xs font-bold uppercase tracking-wide border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-700 outline-none">
                  <optgroup label="Containers"><option value="category">Category</option><option value="list">List</option><option value="menu">Menu</option></optgroup>
                  <optgroup label="Data"><option value="item">Item</option><option value="menu_item">Menu Item</option><option value="field">Data Field</option></optgroup>
                  <optgroup label="Meta"><option value="qa_pair">Q&A Pair</option><option value="note">Internal Note</option></optgroup>
              </select>
           </div>
           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
        </div>
      </div>

      {/* EDITOR BODY */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3"><TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" /><div><h4 className="text-sm font-bold text-amber-800">Validation Warning</h4><p className="text-xs text-amber-700 mt-1">{validationError}</p></div></div>
            )}

            {/* 1. MAIN IDENTITY & SCHEMA SELECTION */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Node Name / Title</label>
                    
                    {/* SCHEMA SELECTOR */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Data Type:</span>
                        <select 
                            value={node.schemaType || 'generic'} 
                            onChange={(e) => handleSchemaChange(e.target.value as SchemaType)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-bold text-blue-600 cursor-pointer hover:border-blue-300"
                        >
                            <option value="generic">Generic Text</option>
                            <option value="event">📅 Event / Activity</option>
                            <option value="dining">🍽️ Restaurant / Bar</option>
                            <option value="room">🛏️ Room / Suite</option>
                        </select>
                    </div>
                </div>
                <input type="text" value={node.name || ''} onChange={(e) => handleChange('name', e.target.value)} className="w-full bg-white text-xl font-bold text-slate-900 border-b-2 border-slate-100 px-2 py-2 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300" placeholder="e.g. Butler Service"/>
                
                {/* 2. DYNAMIC FORM OR GENERIC TEXT AREA */}
                {(!node.schemaType || node.schemaType === 'generic') ? (
                    ['qa_pair', 'note', 'field', 'item', 'menu_item'].includes(String(node.type)) && (
                        <div className="mt-4 relative">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{node.type === 'qa_pair' ? 'Answer' : 'Value'}</label>
                                <button onClick={handleAutoGenerateValue} disabled={isGeneratingValue} className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded border border-violet-100 transition-colors">{isGeneratingValue ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />} AI Generate</button>
                            </div>
                            <textarea value={node.type === 'qa_pair' ? (node.answer || '') : (node.value || '')} onChange={(e) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', e.target.value)} rows={4} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y" placeholder="Content..."/>
                            {node.type === 'qa_pair' && <input type="text" value={node.question || node.name || ''} onChange={(e) => handleChange('question', e.target.value)} className="hidden" />}
                        </div>
                    )
                ) : (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        {/* RENDER SPECIFIC SCHEMA FORM */}
                        {node.schemaType === 'event' && <EventForm data={node.data || {}} onChange={handleDataUpdate} />}
                        {node.schemaType === 'dining' && <DiningForm data={node.data || {}} onChange={handleDataUpdate} />}
                        {node.schemaType === 'room' && <RoomForm data={node.data || {}} onChange={handleDataUpdate} />}
                    </div>
                )}
            </div>

            {/* 3. DYNAMIC ATTRIBUTES (For extra metadata not in schema) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center"><div className="flex items-center gap-2"><Settings size={18} className="text-slate-400" /><h3 className="text-sm font-bold text-slate-700">Extra Properties</h3></div><span className="text-xs text-slate-400">{node.attributes?.length || 0} attributes</span></div>
                <div className="p-6 space-y-3">
                    {node.attributes && node.attributes.map(attr => (
                        <div key={attr.id} className="flex items-center gap-3 group"><div className="w-1/3 min-w-[120px]"><input type="text" value={attr.key} onChange={(e) => handleUpdateAttribute(attr.id, 'key', e.target.value)} className="w-full text-xs font-bold text-slate-600 bg-slate-100 border-transparent rounded px-2 py-1.5 text-right focus:bg-white focus:border-blue-300"/></div><div className="flex-1"><input type="text" value={attr.value} onChange={(e) => handleUpdateAttribute(attr.id, 'value', e.target.value)} className="w-full bg-white text-sm text-slate-800 border border-slate-200 rounded px-3 py-1.5 focus:border-blue-500 outline-none"/></div><button onClick={() => handleDeleteAttribute(attr.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button></div>
                    ))}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-2"><div className="w-1/3 min-w-[120px]"><input type="text" value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()} placeholder="New Property" className="w-full text-xs text-slate-500 bg-white border border-slate-200 border-dashed rounded px-2 py-1.5 text-right focus:border-blue-400 outline-none"/></div><div className="flex-1 flex gap-2"><input type="text" value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()} placeholder="Value" className="flex-1 bg-white text-sm text-slate-600 border border-slate-200 border-dashed rounded px-3 py-1.5 focus:border-blue-400 outline-none"/><button onClick={handleAddAttribute} disabled={!newAttrKey.trim()} className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded text-xs font-bold transition-colors disabled:opacity-50"><Check size={14} /></button></div></div>
                </div>
            </div>

            {/* 4. AI & METADATA */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                 <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Context</label><button onClick={handleAutoGenerateContext} disabled={isGeneratingContext} className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-white hover:bg-violet-50 px-2 py-1 rounded border border-slate-200 transition-colors">{isGeneratingContext ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} Auto-Generate</button></div>
                 <textarea value={node.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 outline-none text-slate-600 italic placeholder:text-slate-300" placeholder="Hidden notes for the AI assistant..."/>
            </div>
            
            <div className="border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400"><div className="flex items-center gap-4"><div className="flex items-center gap-1 group cursor-pointer" onClick={() => handleCopyId(node.id)}><Database size={12} /> ID: <code className="bg-slate-100 px-1 rounded">{node.id}</code>{copiedId === node.id && <Check size={10} className="text-emerald-500"/>}</div></div></div>
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;

import React, { useMemo, useState, useEffect } from 'react';
import { HotelNode, NodeType, NodeAttribute, SchemaType, EventData, DiningData, RoomData } from '../types';
import { analyzeHotelStats, findPathToNode, generateId } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes } from '../services/geminiService';
import { validateNodeInput } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, Trash2, LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  ChevronRight, Database, Check, Settings, List, FileText, CircleHelp, 
  X, FolderOpen, Info, TriangleAlert, Wand2, Calendar, Utensils, BedDouble, Clock, Users, DollarSign,
  ChefHat, Wine, Activity, AlertCircle
} from 'lucide-react';

// --- SUB-COMPONENTS FOR SCHEMAS ---

const EventForm: React.FC<{ data: EventData, onChange: (d: EventData) => void }> = ({ data, onChange }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const updateSchedule = (field: string, value: any) => {
      onChange({ ...data, schedule: { ...data.schedule, [field]: value } });
  };

  const toggleDay = (day: string) => {
    const current = data.schedule?.activeDays || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    updateSchedule('activeDays', updated);
  };

  return (
    <div className="space-y-6 bg-purple-50 p-5 rounded-xl border border-purple-100">
       <div className="flex items-center justify-between border-b border-purple-200 pb-3">
           <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2"><Calendar size={18}/> Activity Scheduler</h4>
           <select 
              value={data.status} 
              onChange={e => onChange({...data, status: e.target.value as any})}
              className={`text-xs font-bold px-2 py-1 rounded border ${data.status === 'active' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}
           >
               <option value="active">Active</option>
               <option value="cancelled">Cancelled</option>
               <option value="moved">Location Changed</option>
           </select>
       </div>

       {data.status !== 'active' && (
           <div className="bg-red-50 border border-red-200 p-2 rounded">
               <label className="text-xs font-bold text-red-600">Cancellation Reason</label>
               <input type="text" value={data.statusReason || ''} onChange={e => onChange({...data, statusReason: e.target.value})} placeholder="e.g. Due to rain" className="w-full mt-1 text-sm p-1 bg-white border border-red-200 rounded text-red-700"/>
           </div>
       )}
       
       {/* Frequency & Dates */}
       <div className="grid grid-cols-2 gap-4">
           <div>
               <label className="text-xs font-bold text-slate-500 uppercase">Frequency</label>
               <select 
                  value={data.schedule?.frequency || 'weekly'} 
                  onChange={e => updateSchedule('frequency', e.target.value)}
                  className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-purple-200 outline-none"
               >
                   <option value="daily">Daily (Every Day)</option>
                   <option value="weekly">Weekly (Specific Days)</option>
                   <option value="biweekly">Bi-Weekly (Every 2 Weeks)</option>
                   <option value="once">One Time (Specific Date)</option>
               </select>
           </div>
           
           {(data.schedule?.frequency === 'biweekly') && (
               <div>
                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                       Cycle Start Date <Info size={10} title="The first Monday of the 2-week cycle" />
                   </label>
                   <input 
                      type="date" 
                      value={data.schedule?.cycleAnchorDate || ''} 
                      onChange={e => updateSchedule('cycleAnchorDate', e.target.value)}
                      className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"
                   />
               </div>
           )}
           
           {(data.schedule?.frequency === 'once') && (
               <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Event Date</label>
                   <input 
                      type="date" 
                      value={data.schedule?.validFrom || ''} 
                      onChange={e => updateSchedule('validFrom', e.target.value)}
                      className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"
                   />
               </div>
           )}
       </div>

       {/* Days Selection (Hidden for One Time) */}
       {data.schedule?.frequency !== 'once' && (
           <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Active Days</label>
             <div className="flex gap-2">
                {days.map(day => (
                  <button 
                    key={day} 
                    onClick={() => toggleDay(day)}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${data.schedule?.activeDays?.includes(day) ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-purple-300 hover:text-purple-500'}`}
                  >
                    {day}
                  </button>
                ))}
             </div>
           </div>
       )}

       {/* Time & Seasonality */}
       <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-200/50">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
            <input type="time" value={data.schedule?.startTime || ''} onChange={e => updateSchedule('startTime', e.target.value)} className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Season End (Optional)</label>
            <input type="date" value={data.schedule?.validUntil || ''} onChange={e => updateSchedule('validUntil', e.target.value)} className="w-full mt-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-500 outline-none"/>
          </div>
       </div>

       {/* Details */}
       <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-3">
           <div>
               <label className="text-xs font-bold text-slate-500 uppercase">Location / Venue</label>
               <input type="text" value={data.location || ''} onChange={e => onChange({...data, location: e.target.value})} placeholder="e.g. Amphitheatre" className="w-full mt-1 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-400"/>
           </div>
           
           <div className="flex gap-4">
               <div className="flex-1">
                   <label className="text-xs font-bold text-slate-500 uppercase">Target Audience</label>
                   <select value={data.ageGroup} onChange={e => onChange({...data, ageGroup: e.target.value as any})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none">
                       <option value="all">Everyone</option>
                       <option value="adults">Adults Only (18+)</option>
                       <option value="kids">Kids Club (4-12)</option>
                       <option value="teens">Teenagers</option>
                   </select>
               </div>
               <div className="flex items-end pb-2">
                   <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                     <input type="checkbox" checked={data.isPaid} onChange={e => onChange({...data, isPaid: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500"/>
                     Paid Event
                   </label>
               </div>
           </div>
       </div>
    </div>
  );
};

const DiningForm: React.FC<{ data: DiningData, onChange: (d: DiningData) => void }> = ({ data, onChange }) => {
    
    const updateFeature = (key: keyof typeof data.features, val: boolean) => {
        onChange({ ...data, features: { ...data.features, [key]: val } });
    };

    const addShift = () => {
        onChange({ ...data, shifts: [...(data.shifts || []), { name: 'Dinner', start: '19:00', end: '21:30' }] });
    };

    const updateShift = (index: number, field: string, value: string) => {
        const newShifts = [...(data.shifts || [])];
        newShifts[index] = { ...newShifts[index], [field]: value };
        onChange({ ...data, shifts: newShifts });
    };

    const removeShift = (index: number) => {
        onChange({ ...data, shifts: (data.shifts || []).filter((_, i) => i !== index) });
    };

    return (
        <div className="space-y-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between border-b border-orange-200 pb-3">
                <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2"><Utensils size={18}/> Culinary Details</h4>
                <div className="flex gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${data.concept === 'all_inclusive' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                        {data.concept === 'all_inclusive' ? 'All Inclusive' : 'Extra Charge'}
                    </span>
                </div>
            </div>
            
            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Restaurant Type</label>
                    <select value={data.type} onChange={e => onChange({...data, type: e.target.value as any})} className="w-full mt-1 bg-white border border-orange-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none">
                        <option value="buffet">Main Buffet</option>
                        <option value="alacarte">A la Carte</option>
                        <option value="snack">Snack / Bistro</option>
                        <option value="patisserie">Patisserie / Cafe</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Cuisine / Theme</label>
                    <input type="text" value={data.cuisine || ''} onChange={e => onChange({...data, cuisine: e.target.value})} placeholder="e.g. Mediterranean" className="w-full mt-1 bg-white border border-orange-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/>
                </div>
            </div>

            {/* Operating Hours (Shifts) */}
            <div className="bg-white/60 p-3 rounded-lg border border-orange-100">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Opening Hours (Shifts)</label>
                    <button onClick={addShift} className="text-[10px] text-blue-600 hover:underline font-bold">+ Add Shift</button>
                </div>
                <div className="space-y-2">
                    {data.shifts?.map((shift, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <input type="text" value={shift.name} onChange={e => updateShift(idx, 'name', e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1" placeholder="Meal Name"/>
                            <input type="time" value={shift.start} onChange={e => updateShift(idx, 'start', e.target.value)} className="w-20 text-xs border border-slate-200 rounded px-1 py-1"/>
                            <span className="text-slate-400">-</span>
                            <input type="time" value={shift.end} onChange={e => updateShift(idx, 'end', e.target.value)} className="w-20 text-xs border border-slate-200 rounded px-1 py-1"/>
                            <button onClick={() => removeShift(idx)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                        </div>
                    ))}
                    {(!data.shifts || data.shifts.length === 0) && <div className="text-xs text-slate-400 italic">No hours defined.</div>}
                </div>
            </div>

            {/* Features Toggles */}
            <div className="bg-white p-3 rounded-lg border border-orange-100">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Dietary & Facilities</label>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={data.features?.hasKidsMenu} onChange={e => updateFeature('hasKidsMenu', e.target.checked)} className="rounded text-orange-500"/>
                        Kids Menu Available
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={data.features?.hasVeganOptions} onChange={e => updateFeature('hasVeganOptions', e.target.checked)} className="rounded text-orange-500"/>
                        Vegan / Vegetarian
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={data.features?.hasGlutenFreeOptions} onChange={e => updateFeature('hasGlutenFreeOptions', e.target.checked)} className="rounded text-orange-500"/>
                        Gluten Free Options
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={data.reservationRequired} onChange={e => onChange({...data, reservationRequired: e.target.checked})} className="rounded text-orange-500"/>
                        Reservation Required
                    </label>
                </div>
            </div>
            
            {/* Highlights */}
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Menu Highlights (Comma separated)</label>
                <input 
                    type="text" 
                    value={data.menuHighlights?.join(', ') || ''} 
                    onChange={e => onChange({...data, menuHighlights: e.target.value.split(',').map(s => s.trim())})} 
                    placeholder="e.g. Signature Steak, Fresh Lobster, Truffle Pasta" 
                    className="w-full mt-1 bg-white border border-orange-200 rounded px-3 py-2 text-sm outline-none placeholder:text-orange-200"
                />
            </div>
        </div>
    );
};

const RoomForm: React.FC<{ data: RoomData, onChange: (d: RoomData) => void }> = ({ data, onChange }) => {
    
    const toggleAmenity = (item: string) => {
        const current = data.amenities || [];
        const updated = current.includes(item) ? current.filter(i => i !== item) : [...current, item];
        onChange({ ...data, amenities: updated });
    };

    const commonAmenities = ["High Speed Wifi", "Smart TV", "Espresso Machine", "Iron & Board", "Safe", "Bathrobes", "Hairdryer", "Kettle"];

    return (
        <div className="space-y-6 bg-indigo-50 p-5 rounded-xl border border-indigo-100">
             <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
                <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><BedDouble size={18}/> Room Specifications</h4>
             </div>
             
             {/* Stats */}
             <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Size (m²)</label>
                    <input type="number" value={data.sizeSqM || ''} onChange={e => onChange({...data, sizeSqM: parseFloat(e.target.value)})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Max Adults</label>
                    <input type="number" value={data.maxOccupancy?.adults || 2} onChange={e => onChange({...data, maxOccupancy: {...data.maxOccupancy, adults: parseInt(e.target.value)}})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Max Children</label>
                    <input type="number" value={data.maxOccupancy?.children || 1} onChange={e => onChange({...data, maxOccupancy: {...data.maxOccupancy, children: parseInt(e.target.value)}})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/>
                </div>
             </div>

             {/* Config */}
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Bed Config</label>
                    <input type="text" value={data.bedConfiguration || ''} onChange={e => onChange({...data, bedConfiguration: e.target.value})} placeholder="1 King + 1 Sofa" className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm outline-none"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">View</label>
                    <select value={data.view} onChange={e => onChange({...data, view: e.target.value as any})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm outline-none">
                        <option value="land">Land View</option>
                        <option value="garden">Garden View</option>
                        <option value="pool">Pool View</option>
                        <option value="sea">Sea View</option>
                        <option value="partial_sea">Partial Sea View</option>
                    </select>
                 </div>
             </div>

             {/* Toggles */}
             <div className="flex gap-4 border-t border-indigo-200 pt-3">
                 <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                    <input type="checkbox" checked={data.hasBalcony} onChange={e => onChange({...data, hasBalcony: e.target.checked})} className="rounded text-indigo-600"/>
                    Balcony
                 </label>
                 <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                    <input type="checkbox" checked={data.hasJacuzzi} onChange={e => onChange({...data, hasJacuzzi: e.target.checked})} className="rounded text-indigo-600"/>
                    Jacuzzi
                 </label>
                 <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                    <input type="checkbox" checked={data.pillowMenuAvailable} onChange={e => onChange({...data, pillowMenuAvailable: e.target.checked})} className="rounded text-indigo-600"/>
                    Pillow Menu
                 </label>
             </div>

             {/* Amenities */}
             <div className="bg-white p-3 rounded-lg border border-indigo-100">
                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Room Amenities</label>
                 <div className="flex flex-wrap gap-2">
                     {commonAmenities.map(am => (
                         <button 
                            key={am}
                            onClick={() => toggleAmenity(am)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${data.amenities?.includes(am) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
                         >
                             {am}
                         </button>
                     ))}
                 </div>
                 <input 
                    type="text" 
                    placeholder="Add other amenities (comma separated)..." 
                    className="w-full mt-3 text-xs border-b border-slate-200 py-1 outline-none focus:border-indigo-400"
                    onBlur={(e) => {
                        if(e.target.value) {
                            const newItems = e.target.value.split(',').map(s=>s.trim()).filter(s=>s);
                            onChange({...data, amenities: [...(data.amenities || []), ...newItems]});
                            e.target.value = '';
                        }
                    }}
                 />
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

  // Initial Data Objects
  const defaultEvent: EventData = { 
      schedule: { frequency: 'weekly', activeDays: [], startTime: '21:30' },
      location: '', ageGroup: 'all', isPaid: false, requiresReservation: false, status: 'active', tags: [] 
  };
  const defaultDining: DiningData = { 
      type: 'buffet', cuisine: '', concept: 'all_inclusive', reservationRequired: false, dressCode: 'Smart Casual', 
      shifts: [], features: { hasKidsMenu: true, hasVeganOptions: true, hasGlutenFreeOptions: false, hasBabyChair: true, hasTerrace: true },
      menuHighlights: [], beverageHighlights: []
  };
  const defaultRoom: RoomData = { 
      sizeSqM: 35, maxOccupancy: { adults: 2, children: 1, total: 3 }, bedConfiguration: '', view: 'land', hasBalcony: true, hasJacuzzi: false, pillowMenuAvailable: false, amenities: [], minibarContent: [], bathroomDetails: '' 
  };

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
     else newData = {};

     onUpdate(node.id, { schemaType: schema, data: newData });
  };

  const handleDataUpdate = (newData: any) => {
      onUpdate(node.id, { data: newData });
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

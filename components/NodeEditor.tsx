import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HotelNode, NodeType, NodeAttribute, SchemaType, EventData, DiningData, RoomData } from '../types';
import { analyzeHotelStats, findPathToNode, generateId } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes } from '../services/geminiService';
import { validateNodeInput } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, Trash2, LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  ChevronRight, Database, Check, Settings, List, FileText, CircleHelp, 
  X, FolderOpen, Info, TriangleAlert, Wand2, Calendar, Utensils, BedDouble, 
  Clock, Users, DollarSign, GripVertical, Type, Layers, Eye, BookOpen, Quote, Printer
} from 'lucide-react';

// --- HELPER COMPONENT: PORTAL-BASED EDUCATIONAL TOOLTIP WITH PLACEMENT ---
type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

const InfoTooltip: React.FC<{ title: string; content: React.ReactNode; placement?: TooltipPlacement }> = ({ title, content, placement = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [style, setStyle] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;
      
      // Calculate position based on placement prop
      switch(placement) {
          case 'top':
              top = rect.top - 10;
              left = rect.left + (rect.width / 2);
              break;
          case 'bottom':
              top = rect.bottom + 10;
              left = rect.left + (rect.width / 2);
              break;
          case 'left':
              top = rect.top + (rect.height / 2);
              left = rect.left - 10;
              break;
          case 'right':
              top = rect.top + (rect.height / 2);
              left = rect.right + 10;
              break;
      }
      
      setStyle({ top, left });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Dynamic transform styles for the tooltip container
  const getTransform = () => {
      switch(placement) {
          case 'top': return 'translate(-50%, -100%)';
          case 'bottom': return 'translate(-50%, 0)';
          case 'left': return 'translate(-100%, -50%)';
          case 'right': return 'translate(0, -50%)';
      }
  };

  // Dynamic arrow styles
  const getArrowStyle = () => {
      switch(placement) {
          case 'top': return 'left-1/2 -bottom-1 -translate-x-1/2 border-r border-b';
          case 'bottom': return 'left-1/2 -top-1 -translate-x-1/2 border-l border-t';
          case 'left': return 'top-1/2 -right-1 -translate-y-1/2 border-t border-r';
          case 'right': return 'top-1/2 -left-1 -translate-y-1/2 border-b border-l';
      }
  };

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave}
        className="group relative inline-flex items-center ml-1.5 align-middle cursor-help"
      >
        <div className="text-slate-400 hover:text-indigo-600 transition-colors">
          <CircleHelp size={15} />
        </div>
      </div>

      {isVisible && createPortal(
        <div 
            className="fixed z-[9999] w-72 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={{ 
                top: style.top, 
                left: style.left,
                transform: getTransform()
            }}
        >
            <div className="bg-slate-800 text-white text-xs rounded-lg shadow-2xl border border-slate-700 overflow-hidden relative">
                <div className="bg-slate-900/90 px-3 py-2.5 font-bold border-b border-white/10 text-indigo-200 flex items-center gap-2">
                    <Info size={12} className="shrink-0" /> {title}
                </div>
                <div className="p-3 text-slate-300 leading-relaxed whitespace-normal text-left">
                    {content}
                </div>
            </div>
            {/* Dynamic Arrow Tip */}
            <div className={`absolute w-2.5 h-2.5 bg-slate-800 border-slate-700 rotate-45 ${getArrowStyle()}`}></div>
        </div>,
        document.body
      )}
    </>
  );
};

// --- LIVE PREVIEW COMPONENT (DOCUMENT STYLE) ---

const LivePreview: React.FC<{ node: HotelNode; level?: number }> = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isContainer = ['category', 'list', 'menu', 'root'].includes(String(node.type));
    
    // Schema renderers (simplified badges/cards)
    const renderSchema = () => {
        if (!node.data) return null;
        if (node.schemaType === 'room') return <div className="inline-flex gap-2 items-center text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 mt-1 font-medium"><BedDouble size={12}/> {node.data.sizeSqM}m² • {node.data.view} • {node.data.maxOccupancy?.adults + node.data.maxOccupancy?.children} Kişi</div>
        if (node.schemaType === 'dining') return <div className="inline-flex gap-2 items-center text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 mt-1 font-medium"><Utensils size={12}/> {node.data.cuisine} • {node.data.type}</div>
        if (node.schemaType === 'event') return <div className="inline-flex gap-2 items-center text-[10px] text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 mt-1 font-medium"><Calendar size={12}/> {node.data.schedule?.frequency} • {node.data.location}</div>
        return null;
    }

    // LEVEL 0: TITLE (The Root of the Preview)
    if (level === 0) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="border-b border-slate-200 pb-6 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-800 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">{node.type}</span>
                        {node.schemaType && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">{node.schemaType}</span>}
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">{node.name || 'İsimsiz Başlık'}</h1>
                    {node.description && <p className="text-lg text-slate-500 mt-4 leading-relaxed font-light">{node.description}</p>}
                </div>
                <div className="space-y-12">
                    {hasChildren ? (
                        node.children?.map(child => <LivePreview key={child.id} node={child} level={level + 1} />)
                    ) : (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 italic">
                            Henüz içerik eklenmemiş...
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // CONTAINER LEVELS (Categories, Lists)
    if (isContainer) {
        // IMPORTANT: Removed 'break-inside-avoid' from the outer div. 
        // Added 'break-after-avoid' to the header section to sticky it to content.
        return (
            <div className="relative print:block">
                 {/* Visual Connector Line for hierarchy - Hidden in print to avoid confusion on page breaks */}
                 {level > 1 && <div className="absolute left-0 top-3 bottom-0 w-px bg-slate-200 -ml-4 print:hidden"></div>}
                 
                 <div className="mb-4">
                    <div className="break-after-avoid">
                        <div className="flex items-baseline gap-3 mb-2 group">
                            {level === 1 ? (
                                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mt-6">
                                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block print:hidden"></span>
                                    {node.name}
                                 </h2>
                            ) : level === 2 ? (
                                 <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mt-4">
                                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full inline-block print:bg-slate-500"></span>
                                    {node.name}
                                 </h3>
                            ) : (
                                 <h4 className="text-md font-bold text-slate-600 uppercase tracking-wide text-xs mt-2 border-b border-slate-100 pb-1">{node.name}</h4>
                            )}
                        </div>
                        {node.value && <p className="text-sm text-slate-500 mb-2 italic pl-4 border-l-2 border-slate-100">{node.value}</p>}
                    </div>
                    
                    {/* Render Children */}
                    <div className={`grid gap-3 ${level === 1 ? 'mt-4 pl-1' : 'mt-2 pl-2'}`}>
                        {hasChildren ? (
                            node.children?.map(child => <LivePreview key={child.id} node={child} level={level + 1} />)
                        ) : (
                            <span className="text-xs text-slate-300 pl-2">...</span>
                        )}
                    </div>
                 </div>
            </div>
        )
    }

    // LEAF NODES (Items, Fields)
    return (
        <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all group break-inside-avoid print:border-slate-300 print:shadow-none" style={{ pageBreakInside: 'avoid' }}>
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${node.type === 'item' ? 'bg-indigo-400' : 'bg-slate-300'} print:bg-slate-800`}></div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{node.name}</span>
                    {node.value && <span className="text-sm text-slate-600 font-normal border-l border-slate-200 pl-2 ml-1">{node.value}</span>}
                </div>
                
                {/* Badges/Attributes */}
                {(node.attributes && node.attributes.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {node.attributes.map(attr => (
                            <span key={attr.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors print:border-slate-400 print:text-slate-700">
                                <span className="opacity-70 mr-1">{attr.key}:</span> {attr.value}
                            </span>
                        ))}
                    </div>
                )}
                
                {renderSchema()}
                
                {node.type === 'qa_pair' && node.answer && (
                    <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded italic relative print:bg-transparent print:p-0">
                        <Quote size={12} className="absolute -top-1.5 -left-1 text-slate-300 bg-white rounded-full print:hidden" />
                        "{node.answer}"
                    </div>
                )}
            </div>
        </div>
    )
}

// --- SUB-COMPONENTS FOR SCHEMAS ---
const EventForm: React.FC<{ data: EventData, onChange: (d: EventData) => void }> = ({ data, onChange }) => {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
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
           <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2"><Calendar size={18}/> Etkinlik Planlayıcı</h4>
           <div className="flex items-center gap-2">
                <InfoTooltip 
                    title="AI Takvim Motoru" 
                    content="Yapay zeka tarihleri dinamik hesaplar. Örn: 'İki Haftada Bir' seçerseniz, AI bugünün tarihine bakarak 'Bugün yoga var mı?' sorusunu döngüye göre yanıtlar." 
                    placement="left"
                />
               <select value={data.status} onChange={e => onChange({...data, status: e.target.value as any})} className={`text-xs font-bold px-2 py-1 rounded border ${data.status === 'active' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                   <option value="active">Aktif</option>
                   <option value="cancelled">İptal Edildi</option>
                   <option value="moved">Yer Değiştirdi</option>
               </select>
           </div>
       </div>
       {data.status !== 'active' && (
           <div className="bg-red-50 border border-red-200 p-2 rounded">
               <label className="text-xs font-bold text-red-600">İptal Nedeni</label>
               <input type="text" value={data.statusReason || ''} onChange={e => onChange({...data, statusReason: e.target.value})} className="w-full mt-1 text-sm p-1 bg-white border border-red-200 rounded text-red-700"/>
           </div>
       )}
       <div className="grid grid-cols-2 gap-4">
           <div>
               <label className="text-xs font-bold text-slate-500 uppercase">Sıklık (Frekans)</label>
               <select value={data.schedule?.frequency || 'weekly'} onChange={e => updateSchedule('frequency', e.target.value)} className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-2 text-sm text-slate-700 outline-none">
                   <option value="daily">Günlük (Her Gün)</option>
                   <option value="weekly">Haftalık (Seçili Günler)</option>
                   <option value="biweekly">İki Haftada Bir (Döngüsel)</option>
                   <option value="once">Tek Seferlik (Tarihli)</option>
               </select>
           </div>
           {(data.schedule?.frequency === 'biweekly') && (
               <div><label className="text-xs font-bold text-slate-500 uppercase">Döngü Başlangıç Tarihi</label><input type="date" value={data.schedule?.cycleAnchorDate || ''} onChange={e => updateSchedule('cycleAnchorDate', e.target.value)} className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
           )}
           {(data.schedule?.frequency === 'once') && (
               <div><label className="text-xs font-bold text-slate-500 uppercase">Etkinlik Tarihi</label><input type="date" value={data.schedule?.validFrom || ''} onChange={e => updateSchedule('validFrom', e.target.value)} className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
           )}
       </div>
       {data.schedule?.frequency !== 'once' && (
           <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Aktif Günler</label><div className="flex gap-2">{days.map(day => (<button key={day} onClick={() => toggleDay(day)} className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${data.schedule?.activeDays?.includes(day) ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-purple-300 hover:text-purple-500'}`}>{day}</button>))}</div></div>
       )}
       <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-200/50">
          <div><label className="text-xs font-bold text-slate-500 uppercase">Başlangıç Saati</label><input type="time" value={data.schedule?.startTime || ''} onChange={e => updateSchedule('startTime', e.target.value)} className="w-full mt-1 bg-white border border-purple-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
          <div><label className="text-xs font-bold text-slate-500 uppercase">Sezon Bitişi (Opsiyonel)</label><input type="date" value={data.schedule?.validUntil || ''} onChange={e => updateSchedule('validUntil', e.target.value)} className="w-full mt-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-500 outline-none"/></div>
       </div>
       <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-3">
           <div><label className="text-xs font-bold text-slate-500 uppercase">Konum / Mekan</label><input type="text" value={data.location || ''} onChange={e => onChange({...data, location: e.target.value})} className="w-full mt-1 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-purple-400"/></div>
           <div className="flex gap-4">
               <div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase">Hedef Kitle</label><select value={data.ageGroup} onChange={e => onChange({...data, ageGroup: e.target.value as any})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm outline-none"><option value="all">Herkes</option><option value="adults">Yetişkin (+18)</option><option value="kids">Çocuk (4-12)</option><option value="teens">Genç</option></select></div>
               <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer"><input type="checkbox" checked={data.isPaid} onChange={e => onChange({...data, isPaid: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500"/>Ücretli Etkinlik</label></div>
           </div>
       </div>
    </div>
  );
};

const DiningForm: React.FC<{ data: DiningData, onChange: (d: DiningData) => void }> = ({ data, onChange }) => {
    const updateFeature = (key: keyof typeof data.features, val: boolean) => { onChange({ ...data, features: { ...data.features, [key]: val } }); };
    const addShift = () => { onChange({ ...data, shifts: [...(data.shifts || []), { name: 'Akşam', start: '19:00', end: '21:30' }] }); };
    const updateShift = (index: number, field: string, value: string) => { const newShifts = [...(data.shifts || [])]; newShifts[index] = { ...newShifts[index], [field]: value }; onChange({ ...data, shifts: newShifts }); };
    const removeShift = (index: number) => { onChange({ ...data, shifts: (data.shifts || []).filter((_, i) => i !== index) }); };

    return (
        <div className="space-y-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between border-b border-orange-200 pb-3">
                <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2"><Utensils size={18}/> Mutfak & Restoran Detayları</h4>
                <div className="flex items-center gap-2">
                    <InfoTooltip title="Yeme & İçme Mantığı" content="'Mutfak Tipi' ve 'Diyet Seçenekleri'ni belirtmek, misafir 'Vegan yemek var mı?' veya 'İtalyan restoranı nerede?' diye sorduğunda AI'ın doğru öneri yapmasını sağlar." placement="left" />
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${data.concept === 'all_inclusive' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{data.concept === 'all_inclusive' ? 'Her Şey Dahil' : 'Ekstra Ücretli'}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Restoran Tipi</label><select value={data.type} onChange={e => onChange({...data, type: e.target.value as any})} className="w-full mt-1 bg-white border border-orange-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"><option value="buffet">Açık Büfe</option><option value="alacarte">A la Carte</option><option value="snack">Snack / Bistro</option><option value="patisserie">Pastane / Kafe</option></select></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Mutfak / Tema</label><input type="text" value={data.cuisine || ''} onChange={e => onChange({...data, cuisine: e.target.value})} className="w-full mt-1 bg-white border border-orange-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none" placeholder="Örn: İtalyan, Deniz Ürünleri"/></div>
            </div>
            <div className="bg-white/60 p-3 rounded-lg border border-orange-100">
                <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-500 uppercase">Açılış Saatleri (Öğünler)</label><button onClick={addShift} className="text-[10px] text-blue-600 font-bold">+ Öğün Ekle</button></div>
                <div className="space-y-2">{data.shifts?.map((shift, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="text" value={shift.name} onChange={e => updateShift(idx, 'name', e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1" placeholder="Öğün Adı"/><input type="time" value={shift.start} onChange={e => updateShift(idx, 'start', e.target.value)} className="w-20 text-xs border border-slate-200 rounded px-1 py-1"/><span className="text-slate-400">-</span><input type="time" value={shift.end} onChange={e => updateShift(idx, 'end', e.target.value)} className="w-20 text-xs border border-slate-200 rounded px-1 py-1"/><button onClick={() => removeShift(idx)} className="text-red-400 hover:text-red-600"><X size={14}/></button></div>))}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-orange-100"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Özellikler & Diyet</label><div className="grid grid-cols-2 gap-y-2 gap-x-4"><label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={data.features?.hasKidsMenu} onChange={e => updateFeature('hasKidsMenu', e.target.checked)} className="rounded text-orange-500"/>Çocuk Menüsü</label><label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={data.features?.hasVeganOptions} onChange={e => updateFeature('hasVeganOptions', e.target.checked)} className="rounded text-orange-500"/>Vegan / Vejetaryen</label><label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={data.features?.hasGlutenFreeOptions} onChange={e => updateFeature('hasGlutenFreeOptions', e.target.checked)} className="rounded text-orange-500"/>Glutensiz Seçenek</label><label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={data.reservationRequired} onChange={e => onChange({...data, reservationRequired: e.target.checked})} className="rounded text-orange-500"/>Rezervasyon Gerekli</label></div></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Menüde Öne Çıkanlar</label><input type="text" value={data.menuHighlights?.join(', ') || ''} onChange={e => onChange({...data, menuHighlights: e.target.value.split(',').map(s => s.trim())})} className="w-full mt-1 bg-white border border-orange-200 rounded px-3 py-2 text-sm outline-none placeholder:text-orange-200" placeholder="Örn: Bonfile, Taze Makarna, Sushi"/></div>
        </div>
    );
};

const RoomForm: React.FC<{ data: RoomData, onChange: (d: RoomData) => void }> = ({ data, onChange }) => {
    const toggleAmenity = (item: string) => { const current = data.amenities || []; const updated = current.includes(item) ? current.filter(i => i !== item) : [...current, item]; onChange({ ...data, amenities: updated }); };
    const commonAmenities = ["Hızlı Wifi", "Akıllı TV", "Espresso Makinesi", "Ütü & Masası", "Kasa", "Bornoz", "Saç Kurutma", "Kettle"];

    return (
        <div className="space-y-6 bg-indigo-50 p-5 rounded-xl border border-indigo-100">
             <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
                <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><BedDouble size={18}/> Oda Özellikleri</h4>
                <InfoTooltip title="Oda Eşleştirme" content="Kişi kapasitesi ve yatak tiplerini doğru girerseniz, AI '4 kişilik bir aile nerede kalabilir?' sorusuna doğru yanıt verir." placement="left" />
             </div>
             <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Boyut (m²)</label><input type="number" value={data.sizeSqM || ''} onChange={e => onChange({...data, sizeSqM: parseFloat(e.target.value)})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Max Yetişkin</label><input type="number" value={data.maxOccupancy?.adults || 2} onChange={e => onChange({...data, maxOccupancy: {...data.maxOccupancy, adults: parseInt(e.target.value)}})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Max Çocuk</label><input type="number" value={data.maxOccupancy?.children || 1} onChange={e => onChange({...data, maxOccupancy: {...data.maxOccupancy, children: parseInt(e.target.value)}})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm text-slate-700 outline-none"/></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Yatak Tipi</label><input type="text" value={data.bedConfiguration || ''} onChange={e => onChange({...data, bedConfiguration: e.target.value})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm outline-none" placeholder="1 Çift + 1 Tek Kişilik"/></div>
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Manzara</label><select value={data.view} onChange={e => onChange({...data, view: e.target.value as any})} className="w-full mt-1 bg-white border border-indigo-200 rounded px-2 py-1.5 text-sm outline-none"><option value="land">Kara Manzaralı</option><option value="garden">Bahçe Manzaralı</option><option value="pool">Havuz Manzaralı</option><option value="sea">Deniz Manzaralı</option><option value="partial_sea">Kısmi Deniz Manzaralı</option></select></div>
             </div>
             <div className="flex gap-4 border-t border-indigo-200 pt-3"><label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer"><input type="checkbox" checked={data.hasBalcony} onChange={e => onChange({...data, hasBalcony: e.target.checked})} className="rounded text-indigo-600"/>Balkon</label><label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer"><input type="checkbox" checked={data.hasJacuzzi} onChange={e => onChange({...data, hasJacuzzi: e.target.checked})} className="rounded text-indigo-600"/>Jakuzi</label><label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer"><input type="checkbox" checked={data.pillowMenuAvailable} onChange={e => onChange({...data, pillowMenuAvailable: e.target.checked})} className="rounded text-indigo-600"/>Yastık Menüsü</label></div>
             <div className="bg-white p-3 rounded-lg border border-indigo-100"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Oda İmkanları</label><div className="flex flex-wrap gap-2">{commonAmenities.map(am => (<button key={am} onClick={() => toggleAmenity(am)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${data.amenities?.includes(am) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>{am}</button>))}</div><input type="text" placeholder="Diğer imkanları virgülle ekleyin..." className="w-full mt-3 text-xs border-b border-slate-200 py-1 outline-none focus:border-indigo-400" onBlur={(e) => { if(e.target.value) { const newItems = e.target.value.split(',').map(s=>s.trim()).filter(s=>s); onChange({...data, amenities: [...(data.amenities || []), ...newItems]}); e.target.value = ''; } }}/></div>
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
  
  const nodeTypeContent = (
      <div className="space-y-2 text-[11px] font-normal">
          <div><strong className="text-indigo-300 block mb-0.5">Category (Kategori):</strong> Alt öğeleri gruplamak için kullanılan klasör yapısı (Örn: "Restoranlar", "Havuzlar").</div>
          <div><strong className="text-indigo-300 block mb-0.5">List / Menu:</strong> Öğeleri listeleyen yapılar. Menu, fiyat bilgisi içerir.</div>
          <div><strong className="text-indigo-300 block mb-0.5">Item (Öğe):</strong> Somut bir hizmet veya varlık (Örn: "Ana Havuz", "Bali Masajı").</div>
          <div><strong className="text-indigo-300 block mb-0.5">Field (Alan):</strong> Tekil veri noktası (Örn: "Giriş Saati", "Wifi Şifresi").</div>
      </div>
  );

  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isGeneratingValue, setIsGeneratingValue] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  
  const previewRef = useRef<HTMLDivElement>(null);

  const defaultEvent: EventData = { schedule: { frequency: 'weekly', activeDays: [], startTime: '21:30' }, location: '', ageGroup: 'all', isPaid: false, requiresReservation: false, status: 'active', tags: [] };
  const defaultDining: DiningData = { type: 'buffet', cuisine: '', concept: 'all_inclusive', reservationRequired: false, dressCode: 'Smart Casual', shifts: [], features: { hasKidsMenu: true, hasVeganOptions: true, hasGlutenFreeOptions: false, hasBabyChair: true, hasTerrace: true }, menuHighlights: [], beverageHighlights: [] };
  const defaultRoom: RoomData = { sizeSqM: 35, maxOccupancy: { adults: 2, children: 1, total: 3 }, bedConfiguration: '', view: 'land', hasBalcony: true, hasJacuzzi: false, pillowMenuAvailable: false, amenities: [], minibarContent: [], bathroomDetails: '' };

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
        <p className="text-sm font-medium">Lütfen soldaki menüden bir öğe seçin.</p>
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
        alert("Önce birkaç özellik ekleyin.");
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

  const handlePrint = () => {
    const printContent = document.getElementById('live-preview-content');
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Print Preview</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write(`
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; padding: 20px; }
          h1, h2, h3, h4 { page-break-after: avoid; }
          .break-after-avoid { page-break-after: avoid; }
          .break-inside-avoid { page-break-inside: avoid; }
          @media print {
            @page { size: A4; margin: 2cm; }
            body { padding: 0; }
            .print\\:hidden { display: none !important; }
            .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
            .print\\:shadow-none { box-shadow: none !important; }
            .print\\:bg-slate-800 { background-color: #1e293b !important; }
            .print\\:text-slate-700 { color: #334155 !important; }
            .print\\:border-slate-400 { border-color: #94a3b8 !important; }
            .print\\:bg-slate-500 { background-color: #64748b !important; }
            .print\\:block { display: block !important; }
          }
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/30">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard size={20} className="text-blue-600"/> Dashboard</h2>
             <div className="flex items-center gap-3 text-xs text-slate-400 mt-1"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">ROOT</span></div>
          </div>
          <div className="text-right">
             <div className="text-sm font-medium text-slate-600">Toplam Öğe</div>
             <div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-end max-w-4xl mx-auto mb-4">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  <Printer size={16} /> Save as PDF
                </button>
            </div>
            <div id="live-preview-content" className="max-w-4xl mx-auto bg-white shadow-xl border border-slate-200 rounded-xl p-10 min-h-[600px] print:shadow-none print:border-none print:p-0">
                <LivePreview node={node} level={0} />
            </div>
            <div className="text-center text-slate-400 text-xs mt-8 pb-4">
                © {new Date().getFullYear()} Generated Knowledge Base Preview
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4">
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
              {breadcrumbs.map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span className={i === breadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500"}>{crumb.name || 'İsimsiz'}</span>
                 </React.Fragment>
              ))}
           </div>
           <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 truncate leading-none pb-0.5">{node.name || 'İsimsiz Öğe'}</h2>
                <InfoTooltip 
                    title="Hiyerarşi Konumu" 
                    content="Bu alan, verinin ağaç yapısındaki yerini gösterir. Doğru klasörleme (Örn: 'Ana Havuz' öğesinin 'Havuzlar' kategorisi altında olması) Yapay Zeka'nın konuyu anlaması için kritiktir." 
                    placement="bottom"
                />
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 pl-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Veri Tipi</span>
                  <InfoTooltip 
                    title="Veri Tipleri Rehberi" 
                    content={nodeTypeContent}
                    placement="bottom" 
                  />
              </div>
              <select value={node.type} onChange={(e) => handleChange('type', e.target.value)} className="text-xs font-bold uppercase tracking-wide border-0 bg-white shadow-sm rounded px-2 py-1.5 text-slate-700 outline-none cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-100 transition-all">
                  <optgroup label="Kapsayıcılar (Gruplama)">
                      <option value="category">Category (Kategori)</option>
                      <option value="list">List (Liste)</option>
                      <option value="menu">Menu (Fiyatlı Liste)</option>
                  </optgroup>
                  <optgroup label="Veri (İçerik)">
                      <option value="item">Item (Öğe / Hizmet)</option>
                      <option value="menu_item">Menu Item (Ürün)</option>
                      <option value="field">Field (Veri Alanı)</option>
                  </optgroup>
                  <optgroup label="Meta (Bilgi)">
                      <option value="qa_pair">Q&A (Soru-Cevap)</option>
                      <option value="note">Note (Not)</option>
                  </optgroup>
              </select>
           </div>

           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Öğeyi Sil"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8 pb-32">
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3"><TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" /><div><h4 className="text-sm font-bold text-amber-800">Doğrulama Uyarısı</h4><p className="text-xs text-amber-700 mt-1">{validationError}</p></div></div>
            )}

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Başlık / İsim</label>
                        <InfoTooltip title="İsimlendirme" content="Anlaşılır ve benzersiz isimler kullanın. 'Havuz' yerine 'Ana Açık Havuz' demek, karışıklığı önler." placement="bottom" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Akıllı Şablon:</span>
                        <select 
                            value={node.schemaType || 'generic'} 
                            onChange={(e) => handleSchemaChange(e.target.value as SchemaType)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-bold text-blue-600 cursor-pointer hover:border-blue-300"
                        >
                            <option value="generic">Genel (Metin)</option>
                            <option value="event">📅 Etkinlik / Aktivite</option>
                            <option value="dining">🍽️ Restoran / Bar</option>
                            <option value="room">🛏️ Oda / Suit</option>
                        </select>
                        <InfoTooltip title="Akıllı Şablonlar Nedir?" content="Bu şablonlar (Event, Room, Dining), AI'ın karmaşık verileri (Açılış Saatleri, Fiyatlar, Yaş Sınırları) daha iyi anlamasını sağlayan özel form alanları açar." placement="bottom" />
                    </div>
                </div>
                <input type="text" value={node.name || ''} onChange={(e) => handleChange('name', e.target.value)} className="w-full bg-white text-xl font-bold text-slate-900 border-b-2 border-slate-100 px-2 py-2 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300" placeholder="Örn: Butler Servisi"/>
                
                {(!node.schemaType || node.schemaType === 'generic') ? (
                    ['qa_pair', 'note', 'field', 'item', 'menu_item'].includes(String(node.type)) && (
                        <div className="mt-4 relative animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{node.type === 'qa_pair' ? 'Cevap' : 'Ana Değer / Açıklama'}</label>
                                    <InfoTooltip title="Ana İçerik" content="Bu alan AI'ın okuyacağı temel bilgidir. 'Kategori' veya 'Liste' tipleri için bu alanı boş bırakıp, alt öğeler eklemek daha doğrudur." />
                                </div>
                                <button onClick={handleAutoGenerateValue} disabled={isGeneratingValue} className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded border border-violet-100 transition-colors">{isGeneratingValue ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />} AI ile Yaz</button>
                            </div>
                            <textarea value={node.type === 'qa_pair' ? (node.answer || '') : (node.value || '')} onChange={(e) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', e.target.value)} rows={4} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y" placeholder="İçerik açıklaması..."/>
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

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Ekstra Özellikler (Key-Value)</h3>
                        <InfoTooltip title="Teknik Özellikler" content="Buraya 'Anahtar: Değer' çiftleri girin. Örn: 'Voltaj: 220V' veya 'Derinlik: 140cm'. AI bu bilgileri kesin gerçekler olarak okur." />
                    </div>
                    <span className="text-xs text-slate-400">{node.attributes?.length || 0} özellik</span>
                </div>
                <div className="p-6 space-y-3">
                    {node.attributes && node.attributes.map(attr => (
                        <div key={attr.id} className="flex items-center gap-3 group"><div className="w-1/3 min-w-[120px]"><input type="text" value={attr.key} onChange={(e) => handleUpdateAttribute(attr.id, 'key', e.target.value)} className="w-full text-xs font-bold text-slate-600 bg-slate-100 border-transparent rounded px-2 py-1.5 text-right focus:bg-white focus:border-blue-300"/></div><div className="flex-1"><input type="text" value={attr.value} onChange={(e) => handleUpdateAttribute(attr.id, 'value', e.target.value)} className="w-full bg-white text-sm text-slate-800 border border-slate-200 rounded px-3 py-1.5 focus:border-blue-500 outline-none"/></div><button onClick={() => handleDeleteAttribute(attr.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button></div>
                    ))}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-2"><div className="w-1/3 min-w-[120px]"><input type="text" value={newAttrKey} onChange={(e) => setNewAttrKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()} placeholder="Yeni Özellik" className="w-full text-xs text-slate-500 bg-white border border-slate-200 border-dashed rounded px-2 py-1.5 text-right focus:border-blue-400 outline-none"/></div><div className="flex-1 flex gap-2"><input type="text" value={newAttrValue} onChange={(e) => setNewAttrValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()} placeholder="Değer" className="flex-1 bg-white text-sm text-slate-600 border border-slate-200 border-dashed rounded px-3 py-1.5 focus:border-blue-400 outline-none"/><button onClick={handleAddAttribute} disabled={!newAttrKey.trim()} className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded text-xs font-bold transition-colors disabled:opacity-50"><Check size={14} /></button></div></div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                 <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Context (Gizli Notlar)</label>
                        <InfoTooltip title="Yapay Zeka Notları" content="Bu alana yazdıklarınızı misafirler görmez, sadece AI görür. Örn: 'Fiyatı sormadıkça söyleme' veya 'Çocuklu ailelere burayı önerme' gibi kurallar yazabilirsiniz." />
                    </div>
                    <button onClick={handleAutoGenerateContext} disabled={isGeneratingContext} className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-white hover:bg-violet-50 px-2 py-1 rounded border border-slate-200 transition-colors">{isGeneratingContext ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} Otomatik Doldur</button>
                 </div>
                 <textarea value={node.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={2} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 outline-none text-slate-600 italic placeholder:text-slate-300" placeholder="Örn: Bu havuz +18'dir, çocuklu aileleri nazikçe ana havuza yönlendir."/>
            </div>
            
            <div className="border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400"><div className="flex items-center gap-4"><div className="flex items-center gap-1 group cursor-pointer" onClick={() => handleCopyId(node.id)}><Database size={12} /> ID: <code className="bg-slate-100 px-1 rounded">{node.id}</code>{copiedId === node.id && <Check size={10} className="text-emerald-500"/>}</div></div></div>
            
            {['category', 'list', 'menu'].includes(String(node.type)) && (
                <div className="mt-8 border-t border-slate-200 pt-8 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="bg-indigo-50 p-1.5 rounded text-indigo-600"><BookOpen size={16} /></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">İçerik Önizlemesi</h3>
                                <p className="text-xs text-slate-500">Bu kategorinin altındaki verilerin belge görünümü.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                            <Printer size={14} /> Download PDF
                        </button>
                    </div>
                    <div id="live-preview-content" className="bg-white shadow-lg border border-slate-100 rounded-xl p-8 min-h-[300px] ring-4 ring-slate-50 print:shadow-none print:border-none print:p-0">
                        <LivePreview node={node} level={1} />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;
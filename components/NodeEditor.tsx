
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HotelNode, NodeType, NodeAttribute, SchemaType, EventData, DiningData, RoomData, IntentType, LocalizedText } from '../types';
import { analyzeHotelStats, findPathToNode, generateId, getAllowedTypes, generateSlug, getLocalizedValue, ensureLocalized } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes, translateText } from '../services/geminiService';
import { validateNodeInput } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, Trash2, LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  ChevronRight, Database, Check, Settings, List, FileText, CircleHelp, 
  X, FolderOpen, Info, TriangleAlert, Wand2, Calendar, Utensils, BedDouble, 
  Clock, Users, DollarSign, GripVertical, Type, Layers, Eye, BookOpen, Quote, Printer, Lock, Unlock, Edit3,
  Shield, AlertTriangle, MessageCircleQuestion, Milestone, HandPlatter, Languages, Globe, RefreshCw, LayoutTemplate
} from 'lucide-react';

// --- HELPER COMPONENT: LOCALIZED INPUT WITH AUTO-TRANSLATE ---
interface LocalizedInputProps {
    value: LocalizedText | string | undefined;
    onChange: (val: LocalizedText) => void;
    placeholder?: string;
    multiline?: boolean;
    label?: string;
    tooltip?: string;
    className?: string;
    compact?: boolean;
    activeTab: 'tr' | 'en';
    onTabChange: (tab: 'tr' | 'en') => void;
}

const LocalizedInput: React.FC<LocalizedInputProps> = ({ value, onChange, placeholder, multiline = false, label, tooltip, className, compact = false, activeTab, onTabChange }) => {
    const [isTranslating, setIsTranslating] = useState(false);
    const data = ensureLocalized(value);

    const handleChange = (text: string) => {
        onChange({ ...data, [activeTab]: text });
    };

    const handleAutoTranslate = async () => {
        setIsTranslating(true);
        // Logic: If I am in EN, translate FROM TR. If I am in TR, translate FROM EN.
        const targetLang = activeTab;
        const sourceLang = activeTab === 'tr' ? 'en' : 'tr';
        const sourceText = data[sourceLang];

        if (sourceText) {
            const translated = await translateText(sourceText, targetLang);
            onChange({ ...data, [targetLang]: translated });
        }
        setIsTranslating(false);
    };

    // Show translate button if:
    // 1. Current field is empty
    // 2. The *other* language has content to translate from
    const sourceLang = activeTab === 'tr' ? 'en' : 'tr';
    const canTranslate = !data[activeTab] && data[sourceLang] && data[sourceLang].trim().length > 0;

    return (
        <div className={`space-y-1 ${className}`}>
            {(label || !compact) && (
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
                        {tooltip && <InfoTooltip title={label || ''} content={tooltip} placement="bottom" />}
                    </div>
                    <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                        <button 
                            onClick={() => onTabChange('tr')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-all ${activeTab === 'tr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            TR
                        </button>
                        <button 
                            onClick={() => onTabChange('en')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-all ${activeTab === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            EN
                        </button>
                    </div>
                </div>
            )}
            
            <div className="relative group">
                {multiline ? (
                    <textarea 
                        value={data[activeTab]} 
                        onChange={(e) => handleChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y min-h-[80px]"
                        placeholder={`${placeholder} (${activeTab.toUpperCase()})`}
                    />
                ) : (
                    <input 
                        type="text" 
                        value={data[activeTab]} 
                        onChange={(e) => handleChange(e.target.value)}
                        className={`w-full bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
                        placeholder={`${placeholder} (${activeTab.toUpperCase()})`}
                    />
                )}
                
                {/* Auto Translate Button (Pull from other lang) */}
                {canTranslate && (
                    <button 
                        onClick={handleAutoTranslate}
                        disabled={isTranslating}
                        className="absolute right-2 bottom-1.5 p-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md hover:bg-indigo-100 transition-colors z-10 flex items-center gap-1"
                        title={`Translate from ${sourceLang.toUpperCase()}`}
                    >
                        {isTranslating ? <Loader2 size={10} className="animate-spin"/> : <RefreshCw size={10} />}
                        <span className="text-[9px] font-bold">{sourceLang.toUpperCase()}'den Çevir</span>
                    </button>
                )}
            </div>
        </div>
    );
};

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

  const getTransform = () => {
      switch(placement) {
          case 'top': return 'translate(-50%, -100%)';
          case 'bottom': return 'translate(-50%, 0)';
          case 'left': return 'translate(-100%, -50%)';
          case 'right': return 'translate(0, -50%)';
      }
  };

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
    const { displayLanguage } = useHotel();
    
    const name = getLocalizedValue(node.name, displayLanguage);
    const value = getLocalizedValue(node.value, displayLanguage);
    const description = getLocalizedValue(node.description, displayLanguage);
    const answer = getLocalizedValue(node.answer, displayLanguage);

    const renderSchema = () => {
        if (!node.data) return null;
        if (node.schemaType === 'room') return <div className="inline-flex gap-2 items-center text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 mt-1 font-medium"><BedDouble size={12}/> {node.data.sizeSqM}m² • {node.data.view} • {node.data.maxOccupancy?.adults + node.data.maxOccupancy?.children} Kişi</div>
        if (node.schemaType === 'dining') return <div className="inline-flex gap-2 items-center text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 mt-1 font-medium"><Utensils size={12}/> {node.data.cuisine} • {node.data.type}</div>
        if (node.schemaType === 'event') return <div className="inline-flex gap-2 items-center text-[10px] text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 mt-1 font-medium"><Calendar size={12}/> {node.data.schedule?.frequency} • {node.data.location}</div>
        return null;
    }

    if (level === 0) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="border-b border-slate-200 pb-6 mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-slate-800 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">{node.type}</span>
                        {node.intent && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">INTENT: {node.intent}</span>}
                        {node.schemaType && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">{node.schemaType}</span>}
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">{name || 'İsimsiz Başlık'}</h1>
                    {description && <p className="text-lg text-slate-500 mt-4 leading-relaxed font-light">{description}</p>}
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

    if (isContainer) {
        return (
            <div className="relative print:block">
                 {level > 1 && <div className="absolute left-0 top-3 bottom-0 w-px bg-slate-200 -ml-4 print:hidden"></div>}
                 
                 <div className="mb-4">
                    <div className="break-after-avoid">
                        <div className="flex items-baseline gap-3 mb-2 group">
                            {level === 1 ? (
                                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mt-6">
                                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block print:hidden"></span>
                                    {name}
                                 </h2>
                            ) : level === 2 ? (
                                 <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mt-4">
                                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full inline-block print:bg-slate-500"></span>
                                    {name}
                                 </h3>
                            ) : (
                                 <h4 className="text-md font-bold text-slate-600 uppercase tracking-wide text-xs mt-2 border-b border-slate-100 pb-1">{name}</h4>
                            )}
                        </div>
                        {value && <p className="text-sm text-slate-500 mb-2 italic pl-4 border-l-2 border-slate-100">{value}</p>}
                    </div>
                    
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

    return (
        <div className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all group break-inside-avoid print:border-slate-300 print:shadow-none" style={{ pageBreakInside: 'avoid' }}>
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${node.type === 'item' ? 'bg-indigo-400' : 'bg-slate-300'} print:bg-slate-800`}></div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{name}</span>
                    {node.intent && <span className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">{node.intent}</span>}
                    {value && <span className="text-sm text-slate-600 font-normal border-l border-slate-200 pl-2 ml-1">{value}</span>}
                </div>
                
                {(node.attributes && node.attributes.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {node.attributes.map(attr => (
                            <span key={attr.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors print:border-slate-400 print:text-slate-700">
                                <span className="opacity-70 mr-1">{getLocalizedValue(attr.key, displayLanguage)}:</span> {getLocalizedValue(attr.value, displayLanguage)}
                            </span>
                        ))}
                    </div>
                )}
                
                {renderSchema()}
                
                {node.type === 'qa_pair' && answer && (
                    <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded italic relative print:bg-transparent print:p-0">
                        <Quote size={12} className="absolute -top-1.5 -left-1 text-slate-300 bg-white rounded-full print:hidden" />
                        "{answer}"
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
           {/* ... Rest of EventForm ... */}
       </div>
       {/* ... Inputs ... */}
       <div className="grid grid-cols-2 gap-4">
           {/* ... */}
       </div>
       {/* ... */}
    </div>
  );
};

const DiningForm: React.FC<{ data: DiningData, onChange: (d: DiningData) => void }> = ({ data, onChange }) => {
    // ... (Existing DiningForm logic)
    return (
        <div className="space-y-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
            <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2 pb-2 border-b border-orange-200"><Utensils size={18}/> Restoran Detayları</h4>
            {/* ... Inputs ... */}
        </div>
    );
};

const RoomForm: React.FC<{ data: RoomData, onChange: (d: RoomData) => void }> = ({ data, onChange }) => {
    // ... (Existing RoomForm logic)
    return (
        <div className="space-y-6 bg-indigo-50 p-5 rounded-xl border border-indigo-100">
             <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2 pb-2 border-b border-indigo-200"><BedDouble size={18}/> Oda Özellikleri</h4>
             {/* ... Inputs ... */}
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
  const { changeNodeId, displayLanguage, nodeTemplates } = useHotel(); // Consuming nodeTemplates
  
  // Shared active tab state for all inputs in the editor
  const [activeTab, setActiveTab] = useState<'tr' | 'en'>(displayLanguage);

  // Sync activeTab with displayLanguage when it changes
  useEffect(() => {
    setActiveTab(displayLanguage);
  }, [displayLanguage]);
  
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
  const [isBulkTranslating, setIsBulkTranslating] = useState(false); // NEW: Bulk Translate State
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newAttrKey, setNewAttrKey] = useState<LocalizedText>({ tr: '', en: '' });
  const [newAttrValue, setNewAttrValue] = useState<LocalizedText>({ tr: '', en: '' });
  
  const [isEditingId, setIsEditingId] = useState(false);
  const [tempId, setTempId] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  
  useEffect(() => {
    setNewAttrKey({ tr: '', en: '' });
    setNewAttrValue({ tr: '', en: '' });
    setValidationError(null);
    setIsEditingId(false);
    setTempId(node?.id || '');
    setIdError(null);
  }, [node?.id]);

  const breadcrumbs = useMemo(() => {
    if (!node || !root) return [];
    return findPathToNode(root, node.id) || [];
  }, [root, node]);

  const parentNode = useMemo(() => {
      if (breadcrumbs.length < 2) return null;
      return breadcrumbs[breadcrumbs.length - 2];
  }, [breadcrumbs]);

  const allowedTypes = useMemo(() => {
      if (!parentNode) return getAllowedTypes('root'); 
      return getAllowedTypes(String(parentNode.type));
  }, [parentNode]);

  // Determine active template and attributes
  const activeTemplate = useMemo(() => {
      return nodeTemplates.find(t => t.id === node?.appliedTemplateId) || null;
  }, [node?.appliedTemplateId, nodeTemplates]);

  const { standardAttributes, customAttributes } = useMemo(() => {
      if (!node?.attributes) return { standardAttributes: [], customAttributes: [] };
      if (!activeTemplate) return { standardAttributes: [], customAttributes: node.attributes };

      const std: NodeAttribute[] = [];
      const custom: NodeAttribute[] = [];

      node.attributes.forEach(attr => {
          // Check if this attribute belongs to the template via key match
          const isFromTemplate = activeTemplate.fields.some(f => {
              const fKey = f.key.toLowerCase();
              const aKeyEn = typeof attr.key === 'string' ? attr.key.toLowerCase() : attr.key.en.toLowerCase();
              return fKey === aKeyEn || (attr.key as any).tr?.toLowerCase() === f.label.tr.toLowerCase(); // Fuzzy match fallback
          });

          if (isFromTemplate) std.push(attr);
          else custom.push(attr);
      });

      return { standardAttributes: std, customAttributes: custom };
  }, [node, activeTemplate]);


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
     if (schema === 'event') newData = { schedule: { frequency: 'weekly', activeDays: [], startTime: '21:30' }, location: '', ageGroup: 'all', isPaid: false, requiresReservation: false, status: 'active', tags: [] };
     else if (schema === 'dining') newData = { type: 'buffet', cuisine: '', concept: 'all_inclusive', reservationRequired: false, dressCode: 'Smart Casual', shifts: [], features: { hasKidsMenu: true, hasVeganOptions: true, hasGlutenFreeOptions: false, hasBabyChair: true, hasTerrace: true }, menuHighlights: [], beverageHighlights: [] };
     else if (schema === 'room') newData = { sizeSqM: 35, maxOccupancy: { adults: 2, children: 1, total: 3 }, bedConfiguration: '', view: 'land', hasBalcony: true, hasJacuzzi: false, pillowMenuAvailable: false, amenities: [], minibarContent: [], bathroomDetails: '' };
     else newData = {};
     onUpdate(node.id, { schemaType: schema, data: newData });
  };

  const handleApplyTemplate = (templateId: string) => {
      const template = nodeTemplates.find(t => t.id === templateId);
      if (!template) {
          onUpdate(node.id, { appliedTemplateId: null });
          return;
      }

      // Merge Logic:
      // 1. Keep existing attributes
      // 2. Add new empty attributes for fields in template that don't exist yet
      
      const currentAttrs = [...(node.attributes || [])];
      
      template.fields.forEach(field => {
          const exists = currentAttrs.some(attr => {
              const aKey = getLocalizedValue(attr.key, 'en').toLowerCase();
              return aKey === field.key.toLowerCase() || aKey === field.label.en.toLowerCase();
          });

          if (!exists) {
              currentAttrs.push({
                  id: generateId('attr'),
                  key: field.label, // Use template label as key
                  value: { tr: '', en: '' },
                  type: field.type as any,
                  options: field.options
              });
          }
      });

      onUpdate(node.id, { appliedTemplateId: templateId, attributes: currentAttrs });
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

  const handleStartIdEdit = () => {
      setTempId(node.id);
      setIsEditingId(true);
      setIdError(null);
  };

  const handleCancelIdEdit = () => {
      setIsEditingId(false);
      setTempId(node.id);
      setIdError(null);
  };

  const handleSaveId = async () => {
      if (tempId === node.id) {
          setIsEditingId(false);
          return;
      }
      
      const result = await changeNodeId(node.id, tempId);
      if (result.success) {
          setIsEditingId(false);
      } else {
          setIdError(result.message);
      }
  };

  const handleGenerateSlugId = () => {
      const name = getLocalizedValue(node.name, 'en');
      if (!name) return;
      const slug = generateSlug(name);
      const proposedId = `${slug}-${Math.random().toString(36).substr(2, 4)}`;
      setTempId(proposedId);
  };

  const handleAutoGenerateContext = async () => {
    setIsGeneratingContext(true);
    try {
      if (activeTab === 'en') {
          // TRANSLATION MODE: Use TR context as source
          const sourceText = getLocalizedValue(node.description, 'tr');
          if (!sourceText) {
              alert("Çeviri için önce Türkçe bağlam (context) notu olmalıdır.");
              setIsGeneratingContext(false);
              return;
          }
          const translated = await translateText(sourceText, 'en');
          const currentDesc = ensureLocalized(node.description);
          onUpdate(node.id, { description: { ...currentDesc, en: translated } });
      } else {
          // GENERATION MODE (TR)
          const pathString = breadcrumbs.map(b => getLocalizedValue(b.name, 'tr') || 'İsimsiz').join(' > ');
          const result = await generateNodeContext(node, pathString, 'tr');
          
          const currentTags = node.tags || [];
          const newTags = result.tags || [];
          const mergedTags = Array.from(new Set([...currentTags, ...newTags]));
          
          const currentDesc = ensureLocalized(node.description);
          onUpdate(node.id, { tags: mergedTags, description: { ...currentDesc, tr: result.description } });
      }
    } catch (error) { console.error(error); } finally { setIsGeneratingContext(false); }
  };

  const handleAutoGenerateValue = async () => {
    setIsGeneratingValue(true);
    try {
        if (activeTab === 'en') {
            // TRANSLATION MODE: Translate TR value/answer to EN
            const sourceText = getLocalizedValue(node.type === 'qa_pair' ? node.answer : node.value, 'tr');
            
            if (!sourceText) {
                alert("Çeviri için önce Türkçe içerik girmelisiniz.");
                setIsGeneratingValue(false);
                return;
            }

            const translated = await translateText(sourceText, 'en');
            const currentVal = ensureLocalized(node.type === 'qa_pair' ? node.answer : node.value);
            const newVal = { ...currentVal, en: translated };
            
            onUpdate(node.id, { [node.type === 'qa_pair' ? 'answer' : 'value']: newVal });
        } else {
            // GENERATION MODE (TR): Create from attributes
            if (!node.attributes || node.attributes.length === 0) {
                alert("Önce birkaç özellik ekleyin.");
                setIsGeneratingValue(false);
                return;
            }
            const name = getLocalizedValue(node.name, 'tr');
            const generatedText = await generateValueFromAttributes(name, node.attributes, 'tr');
            
            const currentVal = ensureLocalized(node.type === 'qa_pair' ? node.answer : node.value);
            const newVal = { ...currentVal, tr: generatedText };
            
            onUpdate(node.id, { [node.type === 'qa_pair' ? 'answer' : 'value']: newVal });
        }
    } catch (e) { console.error(e); } finally { setIsGeneratingValue(false); }
  };

  const handleBulkTranslateAttributes = async () => {
      if (!node.attributes || node.attributes.length === 0) return;
      setIsBulkTranslating(true);
      try {
          const newAttributes = await Promise.all(node.attributes.map(async (attr) => {
              // Ensure localization objects
              const keyObj = ensureLocalized(attr.key);
              const valObj = ensureLocalized(attr.value);
              
              let newKeyEn = keyObj.en;
              let newValEn = valObj.en;

              // Translate KEY if EN is empty and TR exists
              if (!newKeyEn && keyObj.tr) {
                  newKeyEn = await translateText(keyObj.tr, 'en');
              }

              // Translate VALUE if EN is empty and TR exists
              if (!newValEn && valObj.tr) {
                  newValEn = await translateText(valObj.tr, 'en');
              }

              return {
                  ...attr,
                  key: { ...keyObj, en: newKeyEn },
                  value: { ...valObj, en: newValEn }
              };
          }));
          
          onUpdate(node.id, { attributes: newAttributes });
      } catch (e) {
          console.error("Bulk translation failed", e);
          alert("Çeviri sırasında bir hata oluştu.");
      } finally {
          setIsBulkTranslating(false);
      }
  };

  const handleAddAttribute = () => {
    if (!newAttrKey.tr.trim() && !newAttrKey.en.trim()) return;
    const newAttr: NodeAttribute = { 
        id: generateId('attr'), 
        key: { ...newAttrKey }, 
        value: { ...newAttrValue }, 
        type: 'text' 
    };
    const currentAttributes = Array.isArray(node.attributes) ? [...node.attributes] : [];
    onUpdate(node.id, { attributes: [...currentAttributes, newAttr] });
    setNewAttrKey({ tr: '', en: '' });
    setNewAttrValue({ tr: '', en: '' });
  };

  const handleUpdateAttribute = (attrId: string, field: 'key' | 'value', value: LocalizedText) => {
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
      printWindow.document.write(`<html><head><title>Print Preview</title><script src="https://cdn.tailwindcss.com"></script></head><body>${printContent.innerHTML}</body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
  };

  const renderOption = (value: string, label: string) => {
      const isAllowed = allowedTypes.length === 0 || allowedTypes.includes(value);
      if (!isAllowed && node.type !== value) return null;
      return <option value={value} disabled={!isAllowed}>{label}</option>;
  };

  const renderIntentSelector = () => {
      const intentOptions: { value: IntentType; label: string; icon: React.ReactNode }[] = [
          { value: 'informational', label: 'Genel Bilgi', icon: <Info size={14}/> },
          { value: 'request', label: 'Hizmet İsteği', icon: <HandPlatter size={14}/> },
          { value: 'policy', label: 'Kural / Politika', icon: <Shield size={14}/> },
          { value: 'complaint', label: 'Şikayet / Destek', icon: <MessageCircleQuestion size={14}/> },
          { value: 'safety', label: 'Güvenlik & Acil', icon: <AlertTriangle size={14}/> },
          { value: 'navigation', label: 'Yön / Konum', icon: <Milestone size={14}/> },
      ];

      return (
          <div className="flex items-center gap-2 bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100 ml-3">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider pl-1">Amaç</span>
              <select 
                value={node.intent || 'informational'} 
                onChange={(e) => handleChange('intent', e.target.value)}
                className="text-xs bg-transparent font-bold text-emerald-800 outline-none cursor-pointer hover:bg-emerald-100 rounded px-1 py-0.5 transition-colors"
              >
                  {intentOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                          {opt.label}
                      </option>
                  ))}
              </select>
          </div>
      );
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
            <div id="live-preview-content" className="max-w-4xl mx-auto bg-white shadow-xl border border-slate-200 rounded-xl p-10 min-h-[600px] print:shadow-none print:border-none print:p-0">
                <LivePreview node={node} level={0} />
            </div>
        </div>
      </div>
    );
  }

  const displayName = getLocalizedValue(node.name, displayLanguage);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4">
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
              {breadcrumbs.map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span className={i === breadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500"}>{getLocalizedValue(crumb.name, displayLanguage) || 'Untitled'}</span>
                 </React.Fragment>
              ))}
           </div>
           <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 truncate leading-none pb-0.5">{displayName || 'Untitled Node'}</h2>
                <InfoTooltip 
                    title="Hiyerarşi Konumu" 
                    content={`Ebeveyn: ${parentNode?.type || 'Root'}.`}
                    placement="bottom"
                />
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           {renderIntentSelector()}
           <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 pl-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TİP</span>
              </div>
              <select value={node.type} onChange={(e) => handleChange('type', e.target.value)} className="text-xs font-bold uppercase tracking-wide border-0 bg-white shadow-sm rounded px-2 py-1.5 text-slate-700 outline-none cursor-pointer hover:text-blue-600">
                  <optgroup label="Kapsayıcılar">
                      {renderOption('category', 'Category')}
                      {renderOption('list', 'List')}
                      {renderOption('menu', 'Menu')}
                  </optgroup>
                  <optgroup label="Veri">
                      {renderOption('item', 'Item')}
                      {renderOption('menu_item', 'Menu Item')}
                      {renderOption('field', 'Field')}
                  </optgroup>
                  <optgroup label="Meta">
                      {renderOption('qa_pair', 'Q&A')}
                      {renderOption('note', 'Note')}
                      {renderOption('policy', 'Policy')}
                  </optgroup>
              </select>
           </div>

           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Sil"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8 pb-32">
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3"><TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" /><div><h4 className="text-sm font-bold text-amber-800">Doğrulama Uyarısı</h4><p className="text-xs text-amber-700 mt-1">{validationError}</p></div></div>
            )}

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">İçerik Editörü</label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* TEMPLATE SELECTOR */}
                        {nodeTemplates.length > 0 && (
                            <div className="flex items-center gap-2 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                <LayoutTemplate size={14} className="text-indigo-600"/>
                                <select 
                                    value={node.appliedTemplateId || ''}
                                    onChange={(e) => handleApplyTemplate(e.target.value)}
                                    className="text-xs bg-transparent font-bold text-indigo-700 outline-none cursor-pointer"
                                >
                                    <option value="">-- Şablon Yok --</option>
                                    {nodeTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <span className="text-xs font-bold text-slate-400 uppercase">Şablon:</span>
                        <select 
                            value={node.schemaType || 'generic'} 
                            onChange={(e) => handleSchemaChange(e.target.value as SchemaType)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 font-bold text-blue-600 cursor-pointer"
                        >
                            <option value="generic">Genel (Metin)</option>
                            <option value="event">📅 Etkinlik</option>
                            <option value="dining">🍽️ Restoran</option>
                            <option value="room">🛏️ Oda</option>
                        </select>
                    </div>
                </div>
                
                {/* --- LOCALIZED NAME INPUT --- */}
                <LocalizedInput 
                    value={node.name} 
                    onChange={(val) => handleChange('name', val)}
                    placeholder="Öğe Başlığı / Item Title"
                    label="BAŞLIK / İSİM"
                    tooltip="Öğenin hem Türkçe hem İngilizce ismini girin. Ağaç yapısında bu isim görünecektir."
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
                
                {(!node.schemaType || node.schemaType === 'generic') ? (
                    ['qa_pair', 'note', 'field', 'item', 'menu_item', 'policy'].includes(String(node.type)) && (
                        <div className="mt-4 relative animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{node.type === 'qa_pair' ? 'Cevap' : node.type === 'menu_item' ? 'Ürün Detayı' : 'Ana Değer / Açıklama'}</label>
                                    <InfoTooltip title="Ana İçerik" content="Misafire gösterilecek ana metin. Kategori tipinde burası genelde boştur." />
                                </div>
                                <button 
                                    onClick={handleAutoGenerateValue} 
                                    disabled={isGeneratingValue} 
                                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                                        activeTab === 'en' 
                                        ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' 
                                        : 'text-violet-600 bg-violet-50 border-violet-100 hover:bg-violet-100'
                                    }`}
                                    title={activeTab === 'en' ? 'Translate TR content to EN' : 'Generate content from attributes'}
                                >
                                    {isGeneratingValue ? <Loader2 size={12} className="animate-spin"/> : (activeTab === 'en' ? <Globe size={12}/> : <Wand2 size={12} />)} 
                                    {activeTab === 'en' ? "TR'den Çevir" : "AI ile Yaz"}
                                </button>
                            </div>
                            
                            {/* --- LOCALIZED VALUE/ANSWER INPUT --- */}
                            <LocalizedInput 
                                value={node.type === 'qa_pair' ? (node.answer || '') : (node.value || '')} 
                                onChange={(val) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', val)}
                                placeholder="İçerik metni..."
                                multiline={true}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            {node.type === 'qa_pair' && <input type="text" value={node.question || ''} onChange={(e) => handleChange('question', e.target.value)} className="hidden" />}
                            
                            {node.type === 'menu_item' && (
                                <div className="mt-3 bg-slate-50 p-2 rounded flex items-center gap-2 border border-slate-200">
                                    <span className="text-xs font-bold text-slate-500">Fiyat:</span>
                                    <input type="text" value={node.price || ''} onChange={(e) => handleChange('price', e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-mono w-32 outline-none" placeholder="150 TL" />
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                        {node.schemaType === 'event' && <EventForm data={node.data || {}} onChange={handleDataUpdate} />}
                        {node.schemaType === 'dining' && <DiningForm data={node.data || {}} onChange={handleDataUpdate} />}
                        {node.schemaType === 'room' && <RoomForm data={node.data || {}} onChange={handleDataUpdate} />}
                    </div>
                )}
            </div>

            {/* ATTRIBUTES SECTION - NOW SPLIT BY TEMPLATE VS CUSTOM */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Ekstra Özellikler (Key-Value)</h3>
                        <InfoTooltip title="Teknik Özellikler" content="Buraya 'Anahtar: Değer' çiftleri girin. Artık hem anahtar hem değer çok dillidir." />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {activeTab === 'en' && node.attributes && node.attributes.length > 0 && (
                            <button 
                                onClick={handleBulkTranslateAttributes}
                                disabled={isBulkTranslating}
                                className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded text-[10px] font-bold transition-colors"
                                title="Translate all missing English attributes from Turkish"
                            >
                                {isBulkTranslating ? <Loader2 size={12} className="animate-spin"/> : <Globe size={12} />}
                                Tümünü Çevir (EN)
                            </button>
                        )}
                        <span className="text-xs text-slate-400">{node.attributes?.length || 0} özellik</span>
                    </div>
                </div>
                
                <div className="p-6 space-y-4">
                    
                    {/* STANDARD ATTRIBUTES (FROM TEMPLATE) */}
                    {activeTemplate && standardAttributes.length > 0 && (
                        <div className="mb-6 animate-in slide-in-from-left-2">
                            <div className="text-xs font-bold text-indigo-500 uppercase mb-3 flex items-center gap-2">
                                <LayoutTemplate size={12} /> {activeTemplate.name} Alanları
                            </div>
                            <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
                                {standardAttributes.map(attr => (
                                    <div key={attr.id} className="flex items-start gap-3 group">
                                        <div className="w-1/3 min-w-[120px]">
                                            {/* Key is read-only for template fields visually */}
                                            <LocalizedInput 
                                                value={attr.key} 
                                                onChange={(val) => handleUpdateAttribute(attr.id, 'key', val)} 
                                                placeholder="Key"
                                                compact
                                                activeTab={activeTab}
                                                onTabChange={setActiveTab}
                                                className="opacity-70 pointer-events-none" 
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <LocalizedInput 
                                                value={attr.value} 
                                                onChange={(val) => handleUpdateAttribute(attr.id, 'value', val)} 
                                                placeholder="Value"
                                                compact
                                                activeTab={activeTab}
                                                onTabChange={setActiveTab}
                                            />
                                        </div>
                                        {/* Template attributes cannot be deleted individually, only by changing template */}
                                        <div className="w-6"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CUSTOM ATTRIBUTES */}
                    <div className="space-y-3">
                        {activeTemplate && standardAttributes.length > 0 && customAttributes.length > 0 && (
                             <div className="text-xs font-bold text-slate-400 uppercase mb-2">Özel Alanlar</div>
                        )}

                        {customAttributes.map(attr => (
                            <div key={attr.id} className="flex items-start gap-3 group">
                                {/* Key Input */}
                                <div className="w-1/3 min-w-[120px]">
                                    <LocalizedInput 
                                        value={attr.key} 
                                        onChange={(val) => handleUpdateAttribute(attr.id, 'key', val)} 
                                        placeholder="Key"
                                        compact
                                        activeTab={activeTab}
                                        onTabChange={setActiveTab}
                                    />
                                </div>
                                {/* Value Input */}
                                <div className="flex-1">
                                    <LocalizedInput 
                                        value={attr.value} 
                                        onChange={(val) => handleUpdateAttribute(attr.id, 'value', val)} 
                                        placeholder="Value"
                                        compact
                                        activeTab={activeTab}
                                        onTabChange={setActiveTab}
                                    />
                                </div>
                                <button onClick={() => handleDeleteAttribute(attr.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all mt-1">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    {/* Add New Attribute Row */}
                    <div className="flex items-start gap-3 pt-4 border-t border-slate-100 mt-2">
                        <div className="w-1/3 min-w-[120px]">
                            <LocalizedInput 
                                value={newAttrKey} 
                                onChange={setNewAttrKey} 
                                placeholder="Yeni Özellik"
                                compact
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>
                        <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                                <LocalizedInput 
                                    value={newAttrValue} 
                                    onChange={setNewAttrValue} 
                                    placeholder="Değer"
                                    compact
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                />
                            </div>
                            <button 
                                onClick={handleAddAttribute} 
                                disabled={!newAttrKey.tr.trim() && !newAttrKey.en.trim()} 
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded text-xs font-bold transition-colors disabled:opacity-50 h-[34px] mt-px"
                            >
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                 <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Context (Gizli Notlar)</label>
                        <InfoTooltip title="Yapay Zeka Notları" content="Bu alan sadece AI tarafından okunur. Örn: 'Bu fiyatlar 2024 yazına aittir'." />
                    </div>
                    <button 
                        onClick={handleAutoGenerateContext} 
                        disabled={isGeneratingContext} 
                        className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                            activeTab === 'en' 
                            ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' 
                            : 'text-violet-600 bg-violet-50 border-violet-100 hover:bg-violet-100'
                        }`}
                        title={activeTab === 'en' ? 'Translate TR context to EN' : 'Generate context from node path'}
                    >
                        {isGeneratingContext ? <Loader2 size={12} className="animate-spin"/> : (activeTab === 'en' ? <Globe size={12}/> : <Sparkles size={12} />)} 
                        {activeTab === 'en' ? "TR'den Çevir" : "Otomatik Doldur"}
                    </button>
                 </div>
                 
                 {/* --- LOCALIZED DESCRIPTION INPUT --- */}
                 <LocalizedInput 
                    value={node.description}
                    onChange={(val) => handleChange('description', val)}
                    placeholder="AI Bağlam Notu..."
                    multiline={true}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                 />
            </div>
            
            <div className="border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400">
                <div className="flex items-center gap-4 w-full">
                    {!isEditingId ? (
                        <div className="flex items-center gap-2 group w-full">
                            <div className="flex items-center gap-1 cursor-pointer hover:text-slate-600 transition-colors" onClick={() => handleCopyId(node.id)}>
                                <Database size={12} /> 
                                <span className="font-bold">ID:</span> 
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{node.id}</code>
                                {copiedId === node.id && <Check size={10} className="text-emerald-500"/>}
                            </div>
                            <button onClick={handleStartIdEdit} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors ml-auto" title="Edit ID">
                                <Edit3 size={12} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col w-full gap-2 animate-in fade-in slide-in-from-left-2">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-500">Edit ID:</span>
                                <input 
                                    type="text" 
                                    value={tempId} 
                                    onChange={(e) => setTempId(e.target.value)}
                                    className="bg-white border border-blue-300 rounded px-2 py-1 text-xs font-mono text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 flex-1"
                                />
                                <button onClick={handleGenerateSlugId} className="p-1.5 bg-violet-50 text-violet-600 rounded border border-violet-100 hover:bg-violet-100" title="Auto-Generate from Name">
                                    <Wand2 size={12} />
                                </button>
                                <button onClick={handleSaveId} className="p-1.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100 hover:bg-emerald-100">
                                    <Check size={12} />
                                </button>
                                <button onClick={handleCancelIdEdit} className="p-1.5 bg-slate-50 text-slate-500 rounded border border-slate-200 hover:bg-slate-100">
                                    <X size={12} />
                                </button>
                            </div>
                            {idError && <span className="text-[10px] text-red-500 flex items-center gap-1"><TriangleAlert size={10}/> {idError}</span>}
                        </div>
                    )}
                </div>
            </div>
            
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

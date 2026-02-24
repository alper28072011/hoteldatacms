
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HotelNode, NodeType, NodeAttribute, SchemaType, IntentType, LocalizedText, FieldType, TemplateField } from '../types';
import { analyzeHotelStats, findPathToNode, generateId, getAllowedTypes, generateSlug, getLocalizedValue, ensureLocalized } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes, translateText } from '../services/geminiService';
import { validateNodeInput, runLocalValidation } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, Trash2, LayoutDashboard, Box, BrainCircuit, Sparkles, Loader2, 
  ChevronRight, Database, Check, Settings, List, FileText, CircleHelp, 
  X, FolderOpen, Info, TriangleAlert, Wand2, Calendar, Utensils, BedDouble, 
  Clock, Users, DollarSign, GripVertical, Type, Layers, Eye, BookOpen, Quote, Printer, Lock, Unlock, Edit3,
  Shield, AlertTriangle, MessageCircleQuestion, Milestone, HandPlatter, Languages, Globe, RefreshCw, LayoutTemplate, 
  ToggleLeft, AlignLeft, Hash, CheckSquare, History, Sliders, Plus, CornerDownRight, Copy, Activity
} from 'lucide-react';
import { HealthIssue } from '../types';

// --- HELPER COMPONENT: NODE HEALTH BANNER ---
const NodeHealthBanner: React.FC<{ node: HotelNode, issues: HealthIssue[] }> = ({ node, issues }) => {
    const aiScore = node.aiConfidence !== undefined ? node.aiConfidence : 100; // Default to 100 if not scanned
    const hasLocalIssues = issues.length > 0;
    
    // Determine Status
    let status: 'critical' | 'warning' | 'good' = 'good';
    if (aiScore < 50 || issues.some(i => i.severity === 'critical')) status = 'critical';
    else if (aiScore < 80 || issues.length > 0) status = 'warning';

    if (status === 'good') {
         // Show success message if local checks pass but AI hasn't scanned yet (or score is high)
         if (node.aiConfidence === undefined && !hasLocalIssues) {
             return (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 mb-6 flex items-center gap-3 animate-in fade-in">
                    <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-full"><Check size={16} /></div>
                    <div className="text-xs text-emerald-700 font-medium">
                        Yerel kontroller başarılı. Tam onay için AI taraması yapabilirsiniz.
                    </div>
                </div>
             );
         }
         return null; 
    }

    return (
        <div className={`rounded-lg border p-4 mb-6 animate-in slide-in-from-top-2 ${
            status === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full shrink-0 ${
                    status === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                    <Activity size={20} />
                </div>
                <div className="flex-1">
                    <h4 className={`text-sm font-bold mb-1 ${
                        status === 'critical' ? 'text-red-800' : 'text-amber-800'
                    }`}>
                        Veri Sağlığı Uyarısı
                    </h4>
                    
                    <div className="space-y-2">
                        {/* AI Score Warning */}
                        {aiScore < 80 && (
                            <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                                <span className={`w-2 h-2 rounded-full ${aiScore < 50 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}></span>
                                <span>
                                    AI Güven Skoru: <strong>%{aiScore}</strong> 
                                    {aiScore < 50 ? ' (Kritik Düzeyde Düşük)' : ' (İyileştirilmesi Önerilir)'}
                                </span>
                            </div>
                        )}

                        {/* Local Issues */}
                        {issues.map((issue, idx) => (
                            <div key={idx} className={`text-xs flex items-start gap-1.5 ${
                                status === 'critical' ? 'text-red-700' : 'text-amber-700'
                            }`}>
                                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                                <span>{issue.message}</span>
                            </div>
                        ))}
                    </div>

                    {/* Suggestion Footer */}
                    <div className={`mt-3 text-[11px] font-medium border-t pt-2 ${
                         status === 'critical' ? 'border-red-200 text-red-600' : 'border-amber-200 text-amber-600'
                    }`}>
                        <span className="flex items-center gap-1">
                            <Sparkles size={12} />
                            ÖNERİ: {issues[0]?.fix?.description || "Eksik alanları doldurun veya çevirileri tamamlayın."}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- HELPER COMPONENT: LANGUAGE TOGGLE ---
const LanguageToggle = ({ activeTab, onTabChange }: { activeTab: 'tr' | 'en', onTabChange: (t: 'tr' | 'en') => void }) => (
    <div className="flex items-center bg-white rounded-md p-0.5 border border-slate-200 shadow-sm ml-auto">
        <button 
            onClick={() => onTabChange('tr')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-all ${activeTab === 'tr' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
        >
            TR
        </button>
        <button 
            onClick={() => onTabChange('en')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition-all ${activeTab === 'en' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
        >
            EN
        </button>
    </div>
);

// --- HELPER COMPONENT: PORTAL-BASED EDUCATIONAL TOOLTIP ---
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
          case 'top': top = rect.top - 10; left = rect.left + (rect.width / 2); break;
          case 'bottom': top = rect.bottom + 10; left = rect.left + (rect.width / 2); break;
          case 'left': top = rect.top + (rect.height / 2); left = rect.left - 10; break;
          case 'right': top = rect.top + (rect.height / 2); left = rect.right + 10; break;
      }
      
      setStyle({ top, left });
      setIsVisible(true);
    }
  };

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={() => setIsVisible(false)}
        className="group relative inline-flex items-center ml-1.5 align-middle cursor-help"
      >
        <div className="text-slate-400 hover:text-indigo-600 transition-colors">
          <CircleHelp size={14} />
        </div>
      </div>

      {isVisible && createPortal(
        <div 
            className="fixed z-[9999] w-72 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={{ top: style.top, left: style.left, transform: 'translate(-50%, -100%)' }}
        >
            <div className="bg-slate-800 text-white text-xs rounded-lg shadow-2xl border border-slate-700 overflow-hidden relative">
                <div className="bg-slate-900/90 px-3 py-2.5 font-bold border-b border-white/10 text-indigo-200 flex items-center gap-2">
                    <Info size={12} className="shrink-0" /> {title}
                </div>
                <div className="p-3 text-slate-300 leading-relaxed whitespace-normal text-left">{content}</div>
            </div>
            <div className="absolute w-2.5 h-2.5 bg-slate-800 border-slate-700 rotate-45 left-1/2 -bottom-1 -translate-x-1/2 border-r border-b"></div>
        </div>,
        document.body
      )}
    </>
  );
};

// --- HELPER COMPONENT: LOCALIZED INPUT WITH INTEGRATED ACTIONS ---
interface LocalizedInputProps {
    value: LocalizedText | string | undefined;
    onChange: (val: LocalizedText) => void;
    placeholder?: string;
    multiline?: boolean;
    label?: string;
    tooltip?: string;
    className?: string;
    inputClassName?: string;
    compact?: boolean;
    activeTab: 'tr' | 'en';
    onTabChange: (tab: 'tr' | 'en') => void;
    actionButton?: React.ReactNode; 
    hasError?: boolean;
}

const LocalizedInput: React.FC<LocalizedInputProps> = ({ 
    value, onChange, placeholder, multiline = false, label, tooltip, className, inputClassName, compact = false, activeTab, onTabChange, actionButton, hasError
}) => {
    const data = ensureLocalized(value);

    const handleChange = (text: string) => {
        onChange({ ...data, [activeTab]: text });
    };

    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                    {tooltip && <InfoTooltip title={label || ''} content={tooltip} placement="bottom" />}
                </div>
            )}
            
            <div className="relative group">
                {multiline ? (
                    <textarea 
                        value={data[activeTab]} 
                        onChange={(e) => handleChange(e.target.value)}
                        className={`w-full bg-white border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y ${hasError ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'} ${inputClassName || 'min-h-[80px]'} ${actionButton ? 'pb-10' : ''}`}
                        placeholder={`${placeholder} (${activeTab.toUpperCase()})`}
                    />
                ) : (
                    <input 
                        type="text" 
                        value={data[activeTab]} 
                        onChange={(e) => handleChange(e.target.value)}
                        className={`w-full bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${hasError ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'} ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} ${actionButton ? 'pr-20' : ''} ${inputClassName || ''}`}
                        placeholder={`${placeholder} (${activeTab.toUpperCase()})`}
                    />
                )}
                
                {actionButton && (
                    <div className="absolute right-2 bottom-2 z-10">
                        {actionButton}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- DYNAMIC FIELD RENDERER ---
const DynamicFieldInput: React.FC<{
    attribute: NodeAttribute;
    fieldDef?: TemplateField; // Optional: If coming from a template, we have stricter rules
    onChange: (val: LocalizedText) => void;
    activeTab: 'tr' | 'en';
    onTabChange: (t: 'tr' | 'en') => void;
    actionButton?: React.ReactNode;
}> = ({ attribute, fieldDef, onChange, activeTab, onTabChange, actionButton }) => {
    
    // Determine strict type from template or fallback to attribute type
    const type = fieldDef?.type || attribute.type;
    
    // BUFFERING STATE
    const [localValue, setLocalValue] = useState<LocalizedText>(ensureLocalized(attribute.value));
    const [isDirty, setIsDirty] = useState(false);

    // Sync from props only when upstream value actually changes
    const propVal = ensureLocalized(attribute.value);
    useEffect(() => {
        setLocalValue(propVal);
        setIsDirty(false);
    }, [propVal.tr, propVal.en, attribute.id]); 

    // Validation Check
    const isRequired = fieldDef?.required;
    const isEmpty = !localValue[activeTab] || localValue[activeTab].trim() === '';
    const hasError = isRequired && isEmpty;

    // --- HANDLERS ---

    const handleLocalChange = (newVal: LocalizedText) => {
        setLocalValue(newVal);
        const current = ensureLocalized(attribute.value);
        const changed = newVal.tr !== current.tr || newVal.en !== current.en;
        setIsDirty(changed);
    };

    const commitChanges = () => {
        onChange(localValue);
    };

    const discardChanges = () => {
        setLocalValue(ensureLocalized(attribute.value));
        setIsDirty(false);
    };

    const handleTextChange = (txt: string) => {
        handleLocalChange({ ...localValue, [activeTab]: txt });
    };

    const handleUniversalChange = (val: string) => onChange({ tr: val, en: val });

    // --- RENDER ACTION BUTTONS ---
    const renderActionButtons = () => {
        if (isDirty) {
            return (
                <div className="flex items-center gap-1 bg-white/80 backdrop-blur-[1px] p-0.5 rounded-md">
                     <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); commitChanges(); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-md shadow-sm transition-all animate-in zoom-in"
                        title="Kaydet"
                    >
                        <Check size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); discardChanges(); }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-500 p-1.5 rounded-md shadow-sm transition-all animate-in zoom-in"
                        title="İptal"
                    >
                        <X size={14} />
                    </button>
                </div>
            )
        }
        return actionButton;
    };

    const inputBorderClass = isDirty 
        ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-100' 
        : (hasError ? 'border-red-300 bg-red-50' : 'border-slate-200');

    // --- RENDERERS ---

    if (type === 'boolean') {
        const isTrue = propVal.tr === 'true' || propVal.tr === 'Yes' || propVal.tr === 'Evet';
        return (
            <button 
                onClick={() => handleUniversalChange(isTrue ? 'false' : 'true')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${isTrue ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            >
                <div className="flex items-center gap-2">
                    {isTrue ? <ToggleLeft size={18} className="rotate-180"/> : <ToggleLeft size={18} className="text-slate-400"/>}
                    <span className="text-sm font-bold">{isTrue ? 'EVET (Active)' : 'HAYIR (Inactive)'}</span>
                </div>
                {isTrue && <Check size={16} />}
            </button>
        );
    }

    if (type === 'date') {
        return (
            <div className="relative">
                <Calendar size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />
                <input 
                    type="date" 
                    value={propVal.tr} 
                    onChange={(e) => handleUniversalChange(e.target.value)}
                    className={`w-full bg-white border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
            </div>
        );
    }

    if (type === 'time') {
        return (
            <div className="relative">
                <Clock size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />
                <input 
                    type="time" 
                    value={propVal.tr} 
                    onChange={(e) => handleUniversalChange(e.target.value)}
                    className={`w-full bg-white border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                />
            </div>
        );
    }

    if (type === 'select') {
        // Resolve options (localized or string array)
        let options: string[] = [];
        if (fieldDef && fieldDef.options) {
            // If options are localized (object), pick active lang
            if (!Array.isArray(fieldDef.options) && typeof fieldDef.options === 'object') {
                options = (fieldDef.options as any)[activeTab] || [];
            } else if (Array.isArray(fieldDef.options)) {
                // Legacy support
                options = fieldDef.options as string[];
            }
        } else if (attribute.options) {
            options = Array.isArray(attribute.options) ? attribute.options : [];
        }

        // Safety check
        if (!Array.isArray(options)) options = [];

        return (
            <div className="relative">
                <select 
                    value={propVal[activeTab] || ''}
                    onChange={(e) => onChange({ ...propVal, [activeTab]: e.target.value })}
                    className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none text-slate-700 ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                >
                    <option value="">Seçiniz...</option>
                    {options.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <List size={14} />
                </div>
            </div>
        );
    }

    if (type === 'multiselect') {
        // Resolve options (localized or string array)
        let options: string[] = [];
        if (fieldDef && fieldDef.options) {
            if (!Array.isArray(fieldDef.options) && typeof fieldDef.options === 'object') {
                options = (fieldDef.options as any)[activeTab] || [];
            } else if (Array.isArray(fieldDef.options)) {
                options = fieldDef.options as string[];
            }
        } else if (attribute.options) {
            options = Array.isArray(attribute.options) ? attribute.options : [];
        }

        // Safety check
        if (!Array.isArray(options)) options = [];

        const currentSelected = propVal[activeTab] ? propVal[activeTab].split(',').map(s => s.trim()) : [];

        const toggleOption = (opt: string) => {
            let newSelected;
            if (currentSelected.includes(opt)) {
                newSelected = currentSelected.filter(s => s !== opt);
            } else {
                newSelected = [...currentSelected, opt];
            }
            onChange({ ...propVal, [activeTab]: newSelected.join(', ') });
        };

        return (
            <div className={`w-full bg-white border rounded-lg p-3 text-sm ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <div className="grid grid-cols-2 gap-2">
                    {options.map((opt, i) => {
                        const isSelected = currentSelected.includes(opt);
                        return (
                            <button
                                key={i}
                                onClick={() => toggleOption(opt)}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${isSelected ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                            >
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'}`}>
                                    {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                {opt}
                            </button>
                        )
                    })}
                </div>
                {options.length === 0 && <span className="text-xs text-slate-400 italic">Seçenek tanımlanmamış.</span>}
            </div>
        );
    }

    // --- BUFFERED INPUT TYPES ---

    if (type === 'textarea') {
        return (
            <LocalizedInput 
                value={localValue} 
                onChange={handleLocalChange} 
                activeTab={activeTab} 
                onTabChange={onTabChange}
                multiline={true}
                placeholder="Detaylı açıklama..."
                actionButton={renderActionButtons()}
                hasError={hasError}
                inputClassName={inputBorderClass}
            />
        );
    }

    if (type === 'currency') {
        return (
            <div className="relative">
                <DollarSign size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-400' : 'text-emerald-600'}`} />
                <LocalizedInput 
                    value={localValue} 
                    onChange={handleLocalChange} 
                    activeTab={activeTab} 
                    onTabChange={onTabChange}
                    className="pl-6" 
                    placeholder="0.00"
                    hasError={hasError}
                    actionButton={renderActionButtons()}
                    inputClassName={inputBorderClass}
                />
            </div>
        );
    }

    if (type === 'number') {
        return (
             <div className="relative group">
                <Hash size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />
                 <input 
                    type="number"
                    value={localValue[activeTab]} 
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitChanges()}
                    placeholder="0"
                    className={`w-full bg-white border rounded-lg pl-9 pr-20 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${inputBorderClass}`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center">
                    {renderActionButtons()}
                </div>
             </div>
        )
    }

    // Default: Text
    return (
        <LocalizedInput 
            value={localValue} 
            onChange={handleLocalChange} 
            activeTab={activeTab} 
            onTabChange={onTabChange}
            placeholder="Değer giriniz..."
            actionButton={renderActionButtons()}
            hasError={hasError}
            inputClassName={inputBorderClass}
        />
    );
};


// --- MAIN COMPONENT ---

export interface NodeEditorProps {
  node: HotelNode;
  root: HotelNode;
  onUpdate: (nodeId: string, updates: Partial<HotelNode>) => void;
  onDelete: (nodeId: string) => void;
  onIdChanged?: (newId: string) => void; // New prop for syncing parent state
}

const NodeEditor: React.FC<NodeEditorProps> = ({ node, root, onUpdate, onDelete, onIdChanged }) => {
  const { changeNodeId, displayLanguage, setDisplayLanguage, nodeTemplates, duplicateNode } = useHotel(); 
  
  const activeTab = displayLanguage; 
  
  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [isGeneratingValue, setIsGeneratingValue] = useState(false);
  const [isBulkTranslating, setIsBulkTranslating] = useState(false); 
  const [translatingFieldId, setTranslatingFieldId] = useState<string | null>(null);
  
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Custom Attribute State
  const [newAttrKey, setNewAttrKey] = useState<LocalizedText>({ tr: '', en: '' });
  const [newAttrValue, setNewAttrValue] = useState<LocalizedText>({ tr: '', en: '' });
  
  // Tag State
  const [tagInput, setTagInput] = useState('');

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
    setTagInput('');
  }, [node?.id]);

  const breadcrumbs = useMemo(() => {
    if (!node || !root) return [];
    return findPathToNode(root, node.id) || [];
  }, [root, node]);

  // Calculate Health Issues (Local)
  const healthIssues = useMemo(() => {
      if (!root || !node) return [];
      return runLocalValidation(root).filter(i => i.nodeId === node.id);
  }, [root, node]);

  // Determine active template
  const activeTemplate = useMemo(() => {
      return nodeTemplates.find(t => t.id === node?.appliedTemplateId) || null;
  }, [node?.appliedTemplateId, nodeTemplates]);

  // --- SEPARATION LOGIC ---
  // We strictly separate "Template Bound Fields" from "Custom User Fields"
  const { templateRenderList, customRenderList, missingRequiredCount } = useMemo(() => {
      if (!node) return { templateRenderList: [], customRenderList: [], missingRequiredCount: 0 };
      
      const currentAttributes = node.attributes || [];
      const templateList: { attr: NodeAttribute, def: TemplateField }[] = [];
      const customList: NodeAttribute[] = [];
      const matchedAttributeIds = new Set<string>();
      let missingCount = 0;

      // 1. Process Template Fields
      if (activeTemplate) {
          activeTemplate.fields.forEach(field => {
              // SPECIAL CASE: SEPARATOR (Does not exist in node attributes, purely visual)
              if (field.type === 'separator') {
                  templateList.push({ 
                      // Create a dummy attribute for rendering, it won't be saved
                      attr: { id: field.id, key: field.label, value: { tr: '', en: '' }, type: 'separator' }, 
                      def: field 
                  });
                  return;
              }

              // Find matching attribute in node by English Key (Source of Truth)
              let match = currentAttributes.find(a => {
                   const aKey = getLocalizedValue(a.key, 'en').toLowerCase();
                   return aKey === getLocalizedValue(field.label, 'en').toLowerCase();
              });

              // If missing, create a virtual placeholder
              if (!match) {
                   match = {
                       id: `temp_${field.id}`,
                       key: field.label, 
                       value: { tr: '', en: '' },
                       type: field.type,
                       options: field.options
                   };
              } else {
                  // Mark as matched so we don't show it in custom list
                  matchedAttributeIds.add(match.id);
              }

              // Validation
              if (field.required) {
                  const val = match.value[activeTab];
                  if (!val || val.trim() === '') missingCount++;
              }

              templateList.push({ attr: match, def: field });
          });
      }

      // 2. Process Custom Fields (Exclude anything matched above)
      currentAttributes.forEach(attr => {
          if (!matchedAttributeIds.has(attr.id)) {
              customList.push(attr);
          }
      });

      return { templateRenderList: templateList, customRenderList: customList, missingRequiredCount: missingCount };

  }, [node, activeTemplate, activeTab]);


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
    // Reset AI Confidence on edit because the content has changed
    onUpdate(node.id, { [field]: value, aiConfidence: undefined });
  };

  const handleApplyTemplate = (templateId: string) => {
      const template = nodeTemplates.find(t => t.id === templateId);
      if (!template) {
          onUpdate(node.id, { appliedTemplateId: null });
          return;
      }

      // Merge Logic: Keep existing, add new empty attributes for fields in template
      const currentAttrs = [...(node.attributes || [])];
      
      template.fields.forEach(field => {
          if (field.type === 'separator') return; // Separators aren't saved in attributes

          const exists = currentAttrs.some(attr => {
              const aKey = getLocalizedValue(attr.key, 'en').toLowerCase();
              return aKey === getLocalizedValue(field.label, 'en').toLowerCase();
          });

          if (!exists) {
              currentAttrs.push({
                  id: generateId('attr'),
                  key: field.label, // Use template label as key
                  value: { tr: '', en: '' },
                  type: field.type,
                  options: field.options
              });
          }
      });

      onUpdate(node.id, { appliedTemplateId: templateId, attributes: currentAttrs });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(node.id);
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      duplicateNode(node.id);
  };

  const handleStartIdEdit = () => { setTempId(node.id); setIsEditingId(true); setIdError(null); };
  const handleCancelIdEdit = () => { setIsEditingId(false); setTempId(node.id); setIdError(null); };

  const handleSaveId = async () => {
      if (tempId === node.id) { setIsEditingId(false); return; }
      const result = await changeNodeId(node.id, tempId);
      if (result.success) { 
          setIsEditingId(false); 
          // Immediately update parent selection state to prevent flicker or view loss
          if (onIdChanged) onIdChanged(tempId);
      } else { 
          setIdError(result.message); 
      }
  };

  const [isTranslatingName, setIsTranslatingName] = useState(false);

  const handleTranslateName = async () => {
    setIsTranslatingName(true);
    try {
        const sourceText = getLocalizedValue(node.name, 'tr');
        if (!sourceText) { 
            alert("Çeviri için önce Türkçe isim girmelisiniz.");
            setIsTranslatingName(false); 
            return; 
        }
        const translated = await translateText(sourceText, 'en');
        const currentName = ensureLocalized(node.name);
        onUpdate(node.id, { name: { ...currentName, en: translated } });
    } catch (error) { console.error(error); } finally { setIsTranslatingName(false); }
  };

  const handleAutoGenerateDescription = async () => {
    setIsGeneratingContext(true);
    try {
      if (activeTab === 'en') {
          // TRANSLATION
          const sourceText = getLocalizedValue(node.description, 'tr');
          if (!sourceText) { alert("Çeviri için önce Türkçe bağlam notu olmalıdır."); setIsGeneratingContext(false); return; }
          const translated = await translateText(sourceText, 'en');
          const currentDesc = ensureLocalized(node.description);
          onUpdate(node.id, { description: { ...currentDesc, en: translated } });
      } else {
          // GENERATION
          const pathString = breadcrumbs.map(b => getLocalizedValue(b.name, 'tr') || 'İsimsiz').join(' > ');
          const result = await generateNodeContext(node, pathString, 'tr');
          const currentDesc = ensureLocalized(node.description);
          // Only update description
          onUpdate(node.id, { description: { ...currentDesc, tr: result.description } });
      }
    } catch (error) { console.error(error); } finally { setIsGeneratingContext(false); }
  };

  const handleAutoGenerateTags = async () => {
    setIsGeneratingTags(true);
    try {
        // Only generate tags in TR mode (or default mode) as tags are usually shared or we just generate them based on content
        // If we want EN tags, we might need a separate call or just use the same tags.
        // For now, assuming tags are language agnostic or primarily TR based on the prompt in geminiService.
        
        const pathString = breadcrumbs.map(b => getLocalizedValue(b.name, 'tr') || 'İsimsiz').join(' > ');
        const result = await generateNodeContext(node, pathString, 'tr');
        const currentTags = node.tags || [];
        const mergedTags = Array.from(new Set([...currentTags, ...(result.tags || [])]));
        
        // Only update tags
        onUpdate(node.id, { tags: mergedTags });
    } catch (error) { console.error(error); } finally { setIsGeneratingTags(false); }
  };

  const handleAutoGenerateValue = async () => {
    setIsGeneratingValue(true);
    try {
        if (activeTab === 'en') {
            const sourceText = getLocalizedValue(node.type === 'qa_pair' ? node.answer : node.value, 'tr');
            if (!sourceText) { alert("Çeviri için önce Türkçe içerik girmelisiniz."); setIsGeneratingValue(false); return; }
            const translated = await translateText(sourceText, 'en');
            const currentVal = ensureLocalized(node.type === 'qa_pair' ? node.answer : node.value);
            const newVal = { ...currentVal, en: translated };
            onUpdate(node.id, { [node.type === 'qa_pair' ? 'answer' : 'value']: newVal });
        } else {
            if (!node.attributes || node.attributes.length === 0) { alert("Önce birkaç özellik ekleyin."); setIsGeneratingValue(false); return; }
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
              const keyObj = ensureLocalized(attr.key);
              const valObj = ensureLocalized(attr.value);
              let newKeyEn = keyObj.en;
              let newValEn = valObj.en;
              if (!newKeyEn && keyObj.tr) newKeyEn = await translateText(keyObj.tr, 'en');
              if (!newValEn && valObj.tr && attr.type !== 'boolean' && attr.type !== 'date' && attr.type !== 'time') {
                  newValEn = await translateText(valObj.tr, 'en');
              }
              return { ...attr, key: { ...keyObj, en: newKeyEn }, value: { ...valObj, en: newValEn } };
          }));
          onUpdate(node.id, { attributes: newAttributes });
      } catch (e) { console.error(e); } finally { setIsBulkTranslating(false); }
  };

  const handleSingleAttributeTranslate = async (attrId: string) => {
      const attr = node.attributes?.find(a => a.id === attrId);
      if (!attr) return;
      
      setTranslatingFieldId(attrId);
      try {
          const valObj = ensureLocalized(attr.value);
          if (valObj.tr && !valObj.en) {
              const translated = await translateText(valObj.tr, 'en');
              handleUpdateAttribute(attrId, 'value', { ...valObj, en: translated });
          }
      } catch (e) { console.error(e); }
      finally { setTranslatingFieldId(null); }
  };

  const handleSubAttributeTranslate = async (parentAttrId: string, subAttrId: string) => {
      const parentAttr = node.attributes?.find(a => a.id === parentAttrId);
      if (!parentAttr || !parentAttr.subAttributes) return;
      
      const subAttr = parentAttr.subAttributes.find(sa => sa.id === subAttrId);
      if (!subAttr) return;

      setTranslatingFieldId(subAttrId);
      try {
          const valObj = ensureLocalized(subAttr.value);
          if (valObj.tr && !valObj.en) {
              const translated = await translateText(valObj.tr, 'en');
              
              // Manual update for sub-attribute
              const currentAttrs = [...(node.attributes || [])];
              const parentIdx = currentAttrs.findIndex(a => a.id === parentAttrId);
              const updatedParent = { ...currentAttrs[parentIdx] };
              const updatedSubs = [...(updatedParent.subAttributes || [])];
              const subIdx = updatedSubs.findIndex(sa => sa.id === subAttrId);
              
              if (subIdx >= 0) {
                  updatedSubs[subIdx] = { ...updatedSubs[subIdx], value: { ...valObj, en: translated } };
                  updatedParent.subAttributes = updatedSubs;
                  currentAttrs[parentIdx] = updatedParent;
                  onUpdate(node.id, { attributes: currentAttrs });
              }
          }
      } catch (e) { console.error(e); }
      finally { setTranslatingFieldId(null); }
  };

  // UNIFIED UPDATE HANDLER
  // Handles updates for both Template-based and Custom attributes
  const handleAttributeUpdate = (attrId: string, fieldDef: TemplateField | undefined, value: LocalizedText, keyUpdate?: LocalizedText) => {
      const currentAttrs = [...(node.attributes || [])];
      
      // If we are updating based on a template field definition
      if (fieldDef) {
          const existingIdx = currentAttrs.findIndex(a => {
              const aKey = getLocalizedValue(a.key, 'en').toLowerCase();
              return aKey === getLocalizedValue(fieldDef.label, 'en').toLowerCase();
          });

          // SMART OPTION SYNC: If Select/Multiselect, try to sync other language automatically
          let syncedValue = { ...value };
          
          // 1. Sync for Select/Multiselect
          if ((fieldDef.type === 'select' || fieldDef.type === 'multiselect') && 
              fieldDef.options && !Array.isArray(fieldDef.options) && typeof fieldDef.options === 'object') {
              
              const options = fieldDef.options as { tr: string[], en: string[] };
              const currentLang = activeTab;
              const otherLang = activeTab === 'tr' ? 'en' : 'tr';
              
              // Only auto-sync if we are updating the current active language value
              if (value[currentLang]) {
                  const currentVals = value[currentLang].split(',').map(s => s.trim());
                  const otherVals: string[] = [];
                  
                  currentVals.forEach(val => {
                      const idx = options[currentLang].indexOf(val);
                      if (idx !== -1 && options[otherLang][idx]) {
                          otherVals.push(options[otherLang][idx]);
                      }
                  });
                  
                  if (otherVals.length > 0) {
                      syncedValue[otherLang] = otherVals.join(', ');
                  }
              }
          }

          // 2. Sync for Numeric/Date/Time types (Universal Values)
          if (['number', 'currency', 'date', 'time'].includes(fieldDef.type)) {
              const currentLang = activeTab;
              const otherLang = activeTab === 'tr' ? 'en' : 'tr';
              if (value[currentLang] !== undefined) {
                  syncedValue[otherLang] = value[currentLang];
              }
          }

          if (existingIdx >= 0) {
              currentAttrs[existingIdx] = { ...currentAttrs[existingIdx], value: syncedValue };
          } else {
              // Create new REAL attribute from the virtual one
              currentAttrs.push({
                  id: generateId('attr'),
                  key: fieldDef.label, 
                  value: syncedValue,
                  type: fieldDef.type,
                  options: fieldDef.options
              });
          }
      } else {
          // Custom Attribute Update
          const existingIdx = currentAttrs.findIndex(a => a.id === attrId);
          if (existingIdx >= 0) {
              if (keyUpdate) currentAttrs[existingIdx].key = keyUpdate;
              else {
                  let syncedValue = { ...value };
                  const attr = currentAttrs[existingIdx];
                  
                  // Sync for Numeric/Date/Time types (Custom Attributes)
                  if (['number', 'currency', 'date', 'time'].includes(attr.type)) {
                      const currentLang = activeTab;
                      const otherLang = activeTab === 'tr' ? 'en' : 'tr';
                      if (value[currentLang] !== undefined) {
                          syncedValue[otherLang] = value[currentLang];
                      }
                  }
                  
                  currentAttrs[existingIdx].value = syncedValue;
              }
          }
      }
      
      onUpdate(node.id, { attributes: currentAttrs, aiConfidence: undefined });
  };

  // HANDLER FOR NESTED ATTRIBUTES (Conditional Logic)
  // This updates the subAttributes array within a parent attribute
  const handleSubAttributeUpdate = (parentAttrId: string, fieldDef: TemplateField, value: LocalizedText) => {
      const currentAttrs = [...(node.attributes || [])];
      const parentIdx = currentAttrs.findIndex(a => a.id === parentAttrId);
      
      if (parentIdx === -1) {
          // Parent attribute doesn't exist yet (virtual). Create it first with default 'true'.
          // This edge case is handled by parent update usually, but for safety:
          return; 
      }

      const parentAttr = { ...currentAttrs[parentIdx] };
      const currentSubs = [...(parentAttr.subAttributes || [])];

      const subIdx = currentSubs.findIndex(sa => {
          const saKey = getLocalizedValue(sa.key, 'en').toLowerCase();
          return saKey === getLocalizedValue(fieldDef.label, 'en').toLowerCase();
      });

      // SMART OPTION SYNC for Sub-attributes
      let syncedValue = { ...value };
      
      // 1. Sync for Select/Multiselect
      if ((fieldDef.type === 'select' || fieldDef.type === 'multiselect') && 
          fieldDef.options && !Array.isArray(fieldDef.options) && typeof fieldDef.options === 'object') {
          
          const options = fieldDef.options as { tr: string[], en: string[] };
          const currentLang = activeTab;
          const otherLang = activeTab === 'tr' ? 'en' : 'tr';
          
          if (value[currentLang]) {
              const currentVals = value[currentLang].split(',').map(s => s.trim());
              const otherVals: string[] = [];
              
              currentVals.forEach(val => {
                  const idx = options[currentLang].indexOf(val);
                  if (idx !== -1 && options[otherLang][idx]) {
                      otherVals.push(options[otherLang][idx]);
                  }
              });
              
              if (otherVals.length > 0) {
                  syncedValue[otherLang] = otherVals.join(', ');
              }
          }
      }

      // 2. Sync for Numeric/Date/Time types
      if (['number', 'currency', 'date', 'time'].includes(fieldDef.type)) {
          const currentLang = activeTab;
          const otherLang = activeTab === 'tr' ? 'en' : 'tr';
          if (value[currentLang] !== undefined) {
              syncedValue[otherLang] = value[currentLang];
          }
      }

      if (subIdx >= 0) {
          currentSubs[subIdx] = { ...currentSubs[subIdx], value: syncedValue };
      } else {
          currentSubs.push({
              id: generateId('subattr'),
              key: fieldDef.label,
              value: syncedValue,
              type: fieldDef.type,
              options: fieldDef.options
          });
      }

      parentAttr.subAttributes = currentSubs;
      currentAttrs[parentIdx] = parentAttr;
      onUpdate(node.id, { attributes: currentAttrs, aiConfidence: undefined });
  };

  const handleUpdateAttribute = (attrId: string, field: 'key' | 'value', value: LocalizedText) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      const updated = currentAttributes.map(a => a.id === attrId ? { ...a, [field]: value } : a);
      onUpdate(node.id, { attributes: updated, aiConfidence: undefined });
  };

  const handleDeleteAttribute = (attrId: string) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      onUpdate(node.id, { attributes: currentAttributes.filter(a => a.id !== attrId), aiConfidence: undefined });
  };

  const handleAddAttribute = () => {
    if (!newAttrKey.tr.trim() && !newAttrKey.en.trim()) return;
    const newAttr: NodeAttribute = { id: generateId('attr'), key: { ...newAttrKey }, value: { ...newAttrValue }, type: 'text' };
    const currentAttributes = Array.isArray(node.attributes) ? [...node.attributes] : [];
    onUpdate(node.id, { attributes: [...currentAttributes, newAttr], aiConfidence: undefined });
    setNewAttrKey({ tr: '', en: '' });
    setNewAttrValue({ tr: '', en: '' });
  };

  const handleAddTag = () => {
      if (!tagInput.trim()) return;
      const currentTags = node.tags || [];
      if (!currentTags.includes(tagInput.trim())) {
          onUpdate(node.id, { tags: [...currentTags, tagInput.trim()], aiConfidence: undefined });
      }
      setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
      const currentTags = node.tags || [];
      onUpdate(node.id, { tags: currentTags.filter(t => t !== tagToRemove), aiConfidence: undefined });
  };

  // UNIFIED HEADER SELECTORS
  const renderHeaderSelectors = () => {
      const containerStyle = (bgColor: string, borderColor: string) => 
          `flex flex-col justify-center h-10 px-2.5 rounded-lg border ${bgColor} ${borderColor} transition-all hover:shadow-sm min-w-[110px] relative group`;
      
      const labelStyle = (textColor: string) => 
          `text-[9px] font-extrabold uppercase tracking-widest ${textColor} absolute top-1 left-2.5 opacity-80`;
      
      const selectStyle = (textColor: string) => 
          `text-xs font-bold bg-transparent outline-none cursor-pointer appearance-none w-full pt-3 pl-0 ${textColor} focus:ring-0 border-none p-0 m-0`;

      return (
          <div className="flex items-center gap-2">
              
              {/* 1. PURPOSE / INTENT */}
              <div className={containerStyle('bg-emerald-50', 'border-emerald-100')}>
                  <span className={labelStyle('text-emerald-700')}>AMAÇ</span>
                  <select 
                    value={node.intent || 'informational'} 
                    onChange={(e) => handleChange('intent', e.target.value)}
                    className={selectStyle('text-emerald-800')}
                  >
                      <option value="informational">Bilgi</option>
                      <option value="request">İstek</option>
                      <option value="policy">Kural</option>
                      <option value="complaint">Şikayet</option>
                      <option value="safety">Güvenlik</option>
                      <option value="navigation">Yön</option>
                  </select>
              </div>

              {/* 2. TYPE */}
              <div className={containerStyle('bg-blue-50', 'border-blue-100')}>
                  <span className={labelStyle('text-blue-700')}>TİP</span>
                  <select 
                    value={node.type} 
                    onChange={(e) => handleChange('type', e.target.value)} 
                    className={selectStyle('text-blue-800')}
                  >
                      <optgroup label="Kapsayıcılar">
                          <option value="category">Category</option>
                          <option value="list">List</option>
                          <option value="menu">Menu</option>
                      </optgroup>
                      <optgroup label="Veri">
                          <option value="item">Item</option>
                          <option value="menu_item">Menu Item</option>
                          <option value="field">Field</option>
                      </optgroup>
                      <optgroup label="Meta">
                          <option value="qa_pair">Q&A</option>
                          <option value="note">Note</option>
                          <option value="policy">Policy</option>
                      </optgroup>
                  </select>
              </div>

              {/* 3. DATA TEMPLATE */}
              <div className={containerStyle('bg-violet-50', 'border-violet-100')}>
                  <span className={labelStyle('text-violet-700')}>VERİ ŞABLONU</span>
                  <select 
                      value={node.appliedTemplateId || ''}
                      onChange={(e) => handleApplyTemplate(e.target.value)}
                      className={selectStyle('text-violet-800')}
                  >
                      <option value="">-- Yok --</option>
                      {nodeTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
              </div>

          </div>
      );
  };

  const formatLastModified = (timestamp?: number) => {
      if (!timestamp) return 'Bilinmiyor';
      return new Date(timestamp).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
      });
  };

  // Helper for action buttons
  const renderActionBtn = (
      isLoading: boolean, 
      action: () => void, 
      type: 'translate' | 'generate' | 'context'
  ) => {
      const isTranslate = (type === 'translate' || type === 'context') && activeTab === 'en';
      
      return (
        <button 
            onClick={action} 
            disabled={isLoading} 
            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border shadow-sm transition-all z-20 ${
                isTranslate
                ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' 
                : 'text-violet-600 bg-violet-50 border-violet-100 hover:bg-violet-100'
            }`}
        >
            {isLoading ? <Loader2 size={12} className="animate-spin"/> : (isTranslate ? <Globe size={12}/> : <Sparkles size={12} />)} 
            {isTranslate ? "Çevir" : (type === 'generate' ? "AI Yaz" : "Oto Doldur")}
        </button>
      );
  };

  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/30">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard size={20} className="text-blue-600"/> Dashboard</h2></div>
          <div className="text-right"><div className="text-sm font-medium text-slate-600">Toplam Öğe</div><div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4 flex items-center">
           <div className="flex flex-wrap items-center gap-2">
              {breadcrumbs.map((crumb, i) => {
                 const isLast = i === breadcrumbs.length - 1;
                 return (
                    <React.Fragment key={crumb.id}>
                        {i > 0 && <ChevronRight size={16} className="text-slate-300" />}
                        <span className={isLast ? "text-lg font-bold text-slate-800" : "text-sm font-medium text-slate-500"}>
                            {getLocalizedValue(crumb.name, displayLanguage) || 'Untitled'}
                        </span>
                    </React.Fragment>
                 );
              })}
           </div>
           
           {/* ID DISPLAY/EDIT AREA */}
           <div className="h-6 w-px bg-slate-200 mx-4 shrink-0"></div>
           <div className="relative flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID:</span>
                {isEditingId ? (
                    <div className="flex items-center gap-1">
                        <input 
                            type="text" 
                            value={tempId} 
                            onChange={(e) => setTempId(e.target.value)} 
                            className={`text-xs border rounded px-1.5 py-0.5 w-32 outline-none font-mono bg-white text-slate-700 ${idError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-indigo-500'}`}
                            autoFocus
                        />
                        <button onClick={handleSaveId} className="p-0.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"><Check size={12}/></button>
                        <button onClick={handleCancelIdEdit} className="p-0.5 bg-slate-100 text-slate-500 rounded hover:bg-slate-200"><X size={12}/></button>
                    </div>
                ) : (
                    <div className="group flex items-center gap-1.5 cursor-pointer" onClick={handleStartIdEdit} title="ID'yi Düzenle">
                        <span className="text-xs font-mono text-slate-500 font-medium group-hover:text-indigo-600 transition-colors">{node.id}</span>
                        <Edit3 size={10} className="text-slate-300 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100" />
                    </div>
                )}
                {idError && <div className="absolute top-full left-0 mt-1 z-50 bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded border border-red-200 shadow-sm whitespace-nowrap">{idError}</div>}
           </div>

        </div>
        <div className="flex items-center gap-3">
           {renderHeaderSelectors()}
           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           
           {/* COPY BUTTON */}
           {['item', 'menu_item', 'field'].includes(node.type) && (
               <button 
                    onClick={handleDuplicateClick} 
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                    title="Kopyala / Çoğalt"
               >
                   <Copy size={18} />
               </button>
           )}

           <button onClick={handleDeleteClick} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Sil"><Trash2 size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6 pb-32">
            
            {/* Validation Errors */}
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 animate-in slide-in-from-top-2"><TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" /><div><h4 className="text-sm font-bold text-amber-800">Doğrulama Uyarısı</h4><p className="text-xs text-amber-700 mt-1">{validationError}</p></div></div>
            )}
            
            <NodeHealthBanner node={node} issues={healthIssues} />
            
            {missingRequiredCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 animate-in slide-in-from-top-2">
                    <Shield size={18} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-red-800">Eksik Zorunlu Alanlar</h4>
                        <p className="text-xs text-red-700 mt-1">Şablonda zorunlu işaretlenmiş {missingRequiredCount} alan boş bırakılmış.</p>
                    </div>
                </div>
            )}

            {/* 1. NAME SECTION */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Tag size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Başlık / İsim</h3>
                    </div>
                    <LanguageToggle activeTab={activeTab} onTabChange={setDisplayLanguage} />
                </div>
                <div className="p-6">
                    <LocalizedInput 
                        value={node.name} 
                        onChange={(val) => handleChange('name', val)}
                        placeholder="Öğe Başlığı..."
                        activeTab={activeTab}
                        onTabChange={setDisplayLanguage}
                        actionButton={activeTab === 'en' ? renderActionBtn(isTranslatingName, handleTranslateName, 'translate') : undefined} 
                    />
                </div>
            </div>
            
            {/* 2. MAIN VALUE SECTION */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <AlignLeft size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">
                            {node.type === 'qa_pair' ? 'Cevap' : 'Ana Değer / Özet'}
                        </h3>
                        <InfoTooltip title="Ana İçerik" content="Misafire gösterilecek ana metin. Şablon kullanıyorsanız burası 'Özet' olarak kalabilir." />
                    </div>
                    <LanguageToggle activeTab={activeTab} onTabChange={setDisplayLanguage} />
                </div>
                
                <div className="p-6">
                    <LocalizedInput 
                        value={node.type === 'qa_pair' ? (node.answer || '') : (node.value || '')} 
                        onChange={(val) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', val)}
                        placeholder="İçerik metni..."
                        multiline={true}
                        activeTab={activeTab}
                        onTabChange={setDisplayLanguage}
                        actionButton={renderActionBtn(isGeneratingValue, handleAutoGenerateValue, 'generate')}
                    />

                    {node.type === 'qa_pair' && <input type="text" value={node.question || ''} onChange={(e) => handleChange('question', e.target.value)} className="hidden" />}
                    
                    {node.type === 'menu_item' && (
                        <div className="mt-3 bg-slate-50 p-2 rounded flex items-center gap-2 border border-slate-200 w-fit">
                            <span className="text-xs font-bold text-slate-500">Fiyat:</span>
                            <input type="text" value={node.price || ''} onChange={(e) => handleChange('price', e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-mono w-32 outline-none" placeholder="150 TL" />
                        </div>
                    )}
                </div>
            </div>

            {/* 3. ATTRIBUTES SECTION (SPLIT) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Sliders size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">
                            {activeTemplate ? `${activeTemplate.name} Verileri` : 'Özellikler & Veriler'}
                        </h3>
                        {activeTemplate && <InfoTooltip title="Şablon Modu" content="Şablon ile tanımlanan standart alanlar yukarıda, eklediğiniz özel alanlar aşağıdadır." />}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {activeTab === 'en' && (templateRenderList.length > 0 || customRenderList.length > 0) && (
                            <button 
                                onClick={handleBulkTranslateAttributes} 
                                disabled={isBulkTranslating} 
                                className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[10px] font-bold transition-colors shadow-sm"
                            >
                                {isBulkTranslating ? <Loader2 size={12} className="animate-spin"/> : <Globe size={12} />} Toplu Çevir
                            </button>
                        )}
                        <LanguageToggle activeTab={activeTab} onTabChange={setDisplayLanguage} />
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    
                    {/* A. TEMPLATE FIELDS (FIXED) */}
                    {activeTemplate && templateRenderList.length > 0 && (
                        <div className="space-y-4">
                            {templateRenderList.map(({ attr, def }) => {
                                // SEPARATOR RENDER LOGIC
                                if (def.type === 'separator') {
                                    return (
                                        <div key={attr.id} className="relative py-6">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-slate-200"></div>
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-white px-3 text-sm font-bold text-indigo-600 uppercase tracking-wider">
                                                    {getLocalizedValue(def.label, activeTab) || 'Bölüm'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                // CONDITION CHECK: Should we show sub-fields?
                                const showSubFields = def.condition && 
                                    getLocalizedValue(attr.value, 'tr').toLowerCase() === def.condition.triggerValue.toLowerCase();

                                // LAYOUT LOGIC:
                                // Multiline fields (textarea/multiselect) align to top (items-start).
                                // Single line fields align to center (items-center) for better visual balance.
                                const isTall = def.type === 'textarea' || def.type === 'multiselect';
                                const alignClass = isTall ? 'items-start' : 'items-center';
                                const labelPadding = isTall ? 'pt-3' : ''; // Push label down slightly for tall inputs

                                return (
                                    <React.Fragment key={attr.id}>
                                        <div className={`flex ${alignClass} gap-6 group pb-4 border-b border-slate-50 last:border-0 last:pb-0`}>
                                            <div className={`w-1/3 min-w-[140px] ${labelPadding}`}>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-3 bg-indigo-400 rounded-full shrink-0"></div>
                                                    <span className="text-xs font-bold text-slate-700 leading-tight">{getLocalizedValue(def.label, activeTab)}</span>
                                                    {def.required && <span className="text-red-500">*</span>}
                                                </div>
                                                {def.aiDescription && <div className="text-[10px] text-slate-400 mt-1 ml-2.5 leading-tight">{getLocalizedValue(def.aiDescription, activeTab)}</div>}
                                            </div>
                                            <div className="flex-1 relative">
                                                <DynamicFieldInput 
                                                    attribute={attr}
                                                    fieldDef={def}
                                                    onChange={(val) => handleAttributeUpdate(attr.id, def, val)}
                                                    activeTab={activeTab}
                                                    onTabChange={setDisplayLanguage}
                                                    actionButton={activeTab === 'en' ? (
                                                        <button 
                                                            onClick={() => handleSingleAttributeTranslate(attr.id)}
                                                            disabled={translatingFieldId === attr.id}
                                                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1"
                                                            title="Translate this field"
                                                        >
                                                            {translatingFieldId === attr.id ? <Loader2 size={10} className="animate-spin"/> : <Globe size={10} />}
                                                        </button>
                                                    ) : undefined}
                                                />
                                            </div>
                                        </div>

                                        {/* NESTED SUB FIELDS RENDER */}
                                        {showSubFields && def.condition && (
                                            <div className="pl-8 ml-4 border-l-2 border-indigo-100 pb-4 -mt-2 space-y-3 animate-in slide-in-from-left-2 fade-in">
                                                {def.condition.fields.map(subDef => {
                                                    // Find existing sub-attribute data or create virtual
                                                    let subMatch = attr.subAttributes?.find(sa => {
                                                        const saKey = getLocalizedValue(sa.key, 'en').toLowerCase();
                                                        return saKey === getLocalizedValue(subDef.label, 'en').toLowerCase();
                                                    });

                                                    if (!subMatch) {
                                                        subMatch = {
                                                            id: `temp_sub_${subDef.id}`,
                                                            key: subDef.label,
                                                            value: { tr: '', en: '' },
                                                            type: subDef.type,
                                                            options: subDef.options
                                                        };
                                                    }
                                                    
                                                    const isSubTall = subDef.type === 'textarea' || subDef.type === 'multiselect';

                                                    return (
                                                        <div key={subDef.id} className={`flex ${isSubTall ? 'items-start' : 'items-center'} gap-4`}>
                                                            <div className={`w-1/3 min-w-[120px] flex items-center gap-1.5 ${isSubTall ? 'pt-2' : ''}`}>
                                                                <CornerDownRight size={12} className="text-indigo-300 shrink-0" />
                                                                <span className="text-xs font-semibold text-slate-600">{getLocalizedValue(subDef.label, activeTab)}</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <DynamicFieldInput 
                                                                    attribute={subMatch}
                                                                    fieldDef={subDef}
                                                                    onChange={(val) => handleSubAttributeUpdate(attr.id, subDef, val)}
                                                                    activeTab={activeTab}
                                                                    onTabChange={setDisplayLanguage}
                                                                    actionButton={activeTab === 'en' ? (
                                                                        <button 
                                                                            onClick={() => handleSubAttributeTranslate(attr.id, subMatch!.id)}
                                                                            disabled={translatingFieldId === subMatch!.id}
                                                                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1"
                                                                            title="Translate this field"
                                                                        >
                                                                            {translatingFieldId === subMatch!.id ? <Loader2 size={10} className="animate-spin"/> : <Globe size={10} />}
                                                                        </button>
                                                                    ) : undefined}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}

                    {/* SEPARATOR IF BOTH EXIST */}
                    {activeTemplate && customRenderList.length > 0 && (
                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Diğer Özellikler / Ekstralar</span>
                            </div>
                        </div>
                    )}

                    {/* B. CUSTOM FIELDS (EDITABLE) */}
                    <div className="space-y-3">
                        {customRenderList.map(attr => {
                            const isTall = attr.type === 'textarea' || attr.type === 'multiselect';
                            return (
                                <div key={attr.id} className={`flex ${isTall ? 'items-start' : 'items-center'} gap-4 group`}>
                                    <div className="w-1/3 min-w-[140px]">
                                        <LocalizedInput 
                                            value={attr.key} 
                                            onChange={(val) => handleAttributeUpdate(attr.id, undefined, attr.value as LocalizedText, val)} 
                                            placeholder="Özellik Adı" 
                                            activeTab={activeTab} 
                                            onTabChange={setDisplayLanguage}
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <DynamicFieldInput 
                                            attribute={attr}
                                            onChange={(val) => handleAttributeUpdate(attr.id, undefined, val)}
                                            activeTab={activeTab}
                                            onTabChange={setDisplayLanguage}
                                            actionButton={activeTab === 'en' ? (
                                                <button 
                                                    onClick={() => handleSingleAttributeTranslate(attr.id)}
                                                    disabled={translatingFieldId === attr.id}
                                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1"
                                                >
                                                    {translatingFieldId === attr.id ? <Loader2 size={10} className="animate-spin"/> : <Globe size={10} />}
                                                </button>
                                            ) : undefined}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteAttribute(attr.id)} 
                                        className={`p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all ${isTall ? 'mt-1' : ''}`}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Add New Attribute Row */}
                    <div className="flex items-center gap-4 pt-6 border-t border-slate-100 mt-2 bg-slate-50/30 p-4 rounded-lg border-dashed border border-slate-200">
                        <div className="w-1/3 min-w-[140px]">
                            <LocalizedInput 
                                value={newAttrKey} 
                                onChange={setNewAttrKey} 
                                placeholder="Yeni Özellik Adı" 
                                activeTab={activeTab} 
                                onTabChange={setDisplayLanguage}
                            />
                        </div>
                        <div className="flex-1 flex gap-3 items-center">
                            <div className="flex-1">
                                <LocalizedInput 
                                    value={newAttrValue} 
                                    onChange={setNewAttrValue} 
                                    placeholder="Değer" 
                                    activeTab={activeTab} 
                                    onTabChange={setDisplayLanguage}
                                />
                            </div>
                            <button 
                                onClick={handleAddAttribute} 
                                disabled={!newAttrKey.tr.trim()} 
                                className="px-4 h-[38px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            >
                                <Plus size={16} /> Ekle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. TAGS / KEYWORDS SECTION (RE-ACTIVATED) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Hash size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Anahtar Kelimeler & SEO</h3>
                        <InfoTooltip title="Semantic Indexing" content="AI modellerinin bu veriyi hızlıca kategorize etmesi için etiketler. RAG (Retrieval) performansını artırır." />
                    </div>
                 </div>
                 <div className="p-6">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {(!node.tags || node.tags.length === 0) && (
                            <span className="text-xs text-slate-400 italic">Henüz etiket eklenmemiş.</span>
                        )}
                        {node.tags && node.tags.map((tag, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
                                #{tag}
                                <button onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-red-500 rounded-full">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                placeholder="Yeni etiket yazıp Enter'a basın..."
                                className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button onClick={handleAddTag} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                                <Plus size={16} />
                            </button>
                        </div>
                        <button 
                            onClick={handleAutoGenerateTags} 
                            disabled={isGeneratingTags}
                            className="bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isGeneratingTags ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            AI ile Üret
                        </button>
                    </div>
                 </div>
            </div>

            {/* 5. AI CONTEXT SECTION */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">AI Context (Gizli Notlar)</h3>
                        <InfoTooltip title="Yapay Zeka Notları" content="Bu alan sadece AI tarafından okunur." />
                    </div>
                    <LanguageToggle activeTab={activeTab} onTabChange={setDisplayLanguage} />
                 </div>
                 <div className="p-6">
                    <LocalizedInput 
                        value={node.description} 
                        onChange={(val) => handleChange('description', val)} 
                        placeholder="AI Bağlam Notu..." 
                        multiline={true} 
                        activeTab={activeTab} 
                        onTabChange={setDisplayLanguage}
                        inputClassName="min-h-[110px]" 
                        actionButton={renderActionBtn(isGeneratingContext, handleAutoGenerateDescription, 'context')}
                    />
                 </div>
            </div>

            {/* LAST MODIFIED FOOTER */}
            <div className="flex items-center justify-end px-2 pt-2 pb-6 opacity-60">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                    <History size={12} />
                    <span>Son Güncelleme: {formatLastModified(node.lastModified)}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NodeEditor;



import React, { useState, useEffect } from 'react';
import { NodeTemplate, TemplateField, LocalizedText, FieldType } from '../types';
import { useHotel } from '../contexts/HotelContext';
import { generateId } from '../utils/treeUtils';
import { 
    X, Plus, Trash2, Save, LayoutTemplate, GripVertical, Check, Info, 
    Type, Hash, Calendar, Clock, ToggleLeft, List, AlignLeft, DollarSign, BrainCircuit, Loader2, CheckSquare, GitMerge
} from 'lucide-react';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyTemplate: NodeTemplate = {
    id: '',
    name: '',
    fields: []
};

// --- ICONS FOR FIELD TYPES ---
const getTypeIcon = (type: FieldType) => {
    switch(type) {
        case 'text': return <Type size={14} className="text-blue-500"/>;
        case 'textarea': return <AlignLeft size={14} className="text-indigo-500"/>;
        case 'number': return <Hash size={14} className="text-emerald-500"/>;
        case 'boolean': return <ToggleLeft size={14} className="text-purple-500"/>;
        case 'select': return <List size={14} className="text-orange-500"/>;
        case 'multiselect': return <CheckSquare size={14} className="text-orange-600"/>;
        case 'date': return <Calendar size={14} className="text-pink-500"/>;
        case 'time': return <Clock size={14} className="text-cyan-500"/>;
        case 'currency': return <DollarSign size={14} className="text-green-600"/>;
        default: return <Type size={14}/>;
    }
};

const getTypeLabel = (type: FieldType) => {
    switch(type) {
        case 'text': return 'Kısa Metin';
        case 'textarea': return 'Uzun Metin';
        case 'number': return 'Sayı';
        case 'boolean': return 'Evet/Hayır';
        case 'select': return 'Tekli Seçim';
        case 'multiselect': return 'Çoklu Seçim';
        case 'date': return 'Tarih';
        case 'time': return 'Saat';
        case 'currency': return 'Para Birimi';
        default: return type;
    }
}

// Localized Input Component
const LocalizedInput: React.FC<{
    value: LocalizedText;
    onChange: (val: LocalizedText) => void;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, placeholder, className }) => {
    return (
        <div className={`flex gap-2 ${className}`}>
            <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">TR</span>
                <input 
                    type="text" 
                    value={value.tr}
                    onChange={(e) => onChange({ ...value, tr: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 bg-white rounded pl-8 pr-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors text-slate-700"
                />
            </div>
            <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">EN</span>
                <input 
                    type="text" 
                    value={value.en}
                    onChange={(e) => onChange({ ...value, en: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 bg-slate-50/50 rounded pl-8 pr-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors text-slate-700"
                />
            </div>
        </div>
    );
};

// Buffered Input for Options (Comma Separated)
const OptionsInput: React.FC<{
    value: string[] | undefined;
    onChange: (val: string[]) => void;
}> = ({ value, onChange }) => {
    const [text, setText] = useState(Array.isArray(value) ? value.join(', ') : '');

    // Sync with prop changes only when not focused or significantly different
    // Here we trust the array join to be canonical.
    useEffect(() => {
        setText(Array.isArray(value) ? value.join(', ') : '');
    }, [value]);

    const handleBlur = () => {
        const options = text.split(',').map(s => s.trim()).filter(s => s !== '');
        onChange(options);
    };

    return (
        <input 
            type="text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            placeholder="Deniz, Kara, Bahçe, Havuz"
            className="w-full border border-slate-200 bg-white rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-300 text-slate-700 placeholder:text-slate-400"
        />
    );
};

const TemplateManager: React.FC<TemplateManagerProps> = ({ isOpen, onClose }) => {
  const { nodeTemplates, addNodeTemplate, updateNodeTemplate, deleteNodeTemplate } = useHotel();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NodeTemplate>(emptyTemplate);
  const [showTypeSelector, setShowTypeSelector] = useState<{index: number, subIndex?: number} | null>(null); // Extended for nested
  
  // Feedback States
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Drag & Drop State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Initialize create mode
  useEffect(() => {
    if (isOpen && !selectedTemplateId) {
        setFormData({ ...emptyTemplate, id: generateId('tpl') });
        setSaveStatus('idle');
    }
  }, [isOpen, selectedTemplateId]);

  const handleSelect = (tpl: NodeTemplate) => {
      setSelectedTemplateId(tpl.id);
      setFormData(JSON.parse(JSON.stringify(tpl))); 
      setSaveStatus('idle');
  };

  const handleCreateNew = () => {
      setSelectedTemplateId(null);
      setFormData({ ...emptyTemplate, id: generateId('tpl') });
      setSaveStatus('idle');
  };

  const handleAddField = (type: FieldType = 'text') => {
      const newField: TemplateField = {
          id: generateId('fld'),
          key: '',
          label: { tr: '', en: '' },
          type: type,
          required: false,
          aiDescription: ''
      };
      setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
      setShowTypeSelector(null);
  };

  const handleUpdateField = (id: string, updates: Partial<TemplateField>) => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
      }));
  };

  const handleDeleteField = (id: string) => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.filter(f => f.id !== id)
      }));
  };

  // --- SUB FIELD HANDLERS ---
  const handleToggleCondition = (parentId: string, enable: boolean) => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f => {
              if (f.id !== parentId) return f;
              if (!enable) return { ...f, condition: undefined };
              return { 
                  ...f, 
                  condition: { 
                      triggerValue: 'true', 
                      fields: [] // Start empty
                  } 
              };
          })
      }));
  };

  const handleAddSubField = (parentId: string, type: FieldType = 'text') => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f => {
              if (f.id !== parentId || !f.condition) return f;
              
              const newSub: TemplateField = {
                  id: generateId('sub'),
                  key: '',
                  label: { tr: '', en: '' },
                  type: type,
                  required: false,
                  aiDescription: ''
              };
              
              return { 
                  ...f, 
                  condition: { 
                      ...f.condition, 
                      fields: [...f.condition.fields, newSub] 
                  } 
              };
          })
      }));
      setShowTypeSelector(null);
  };

  const handleUpdateSubField = (parentId: string, subId: string, updates: Partial<TemplateField>) => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f => {
              if (f.id !== parentId || !f.condition) return f;
              return {
                  ...f,
                  condition: {
                      ...f.condition,
                      fields: f.condition.fields.map(s => s.id === subId ? { ...s, ...updates } : s)
                  }
              };
          })
      }));
  };

  const handleDeleteSubField = (parentId: string, subId: string) => {
      setFormData(prev => ({
          ...prev,
          fields: prev.fields.map(f => {
              if (f.id !== parentId || !f.condition) return f;
              return {
                  ...f,
                  condition: {
                      ...f.condition,
                      fields: f.condition.fields.filter(s => s.id !== subId)
                  }
              };
          })
      }));
  };

  const handleSave = async () => {
      if (!formData.name.trim()) return;
      
      setSaveStatus('saving');

      // Helper to process fields recursively
      const processField = (f: TemplateField): TemplateField => ({
          ...f,
          key: f.key || f.label.en.toLowerCase().replace(/[^a-z0-9]/g, '_') || generateId('k'),
          options: f.options ? f.options.map(o => o.trim()).filter(o => o !== '') : undefined,
          condition: f.condition ? {
              triggerValue: f.condition.triggerValue,
              fields: f.condition.fields.map(sf => processField(sf)) // Recurse
          } : undefined
      });

      const processedFields = formData.fields.map(processField);
      const finalData = { ...formData, fields: processedFields };

      try {
        if (selectedTemplateId) {
            await updateNodeTemplate(finalData);
        } else {
            await addNodeTemplate(finalData);
        }
        setSelectedTemplateId(finalData.id);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error(e);
        setSaveStatus('idle');
      }
  };

  const handleDeleteTemplate = async (id: string) => {
      if (!window.confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;
      await deleteNodeTemplate(id);
      if (selectedTemplateId === id) handleCreateNew();
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedItemIndex === null || draggedItemIndex === index) return;

      const newFields = [...formData.fields];
      const draggedItem = newFields[draggedItemIndex];
      newFields.splice(draggedItemIndex, 1);
      newFields.splice(index, 0, draggedItem);
      
      setFormData(prev => ({ ...prev, fields: newFields }));
      setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
      setDraggedItemIndex(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
               <LayoutTemplate size={24} />
            </div>
            <div>
               <h2 className="text-xl font-bold text-slate-800">Şablon Yöneticisi</h2>
               <p className="text-slate-500 text-sm">Tüm otel verileri için standart formlar ve veri yapıları tasarlayın.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden bg-slate-50">
            
            {/* Sidebar: Template List */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100">
                    <button 
                        onClick={handleCreateNew}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Yeni Şablon
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {nodeTemplates.length === 0 && (
                        <div className="text-center p-6 text-slate-400 text-xs italic">Henüz şablon yok.</div>
                    )}
                    {nodeTemplates.map(tpl => (
                        <div 
                            key={tpl.id}
                            onClick={() => handleSelect(tpl)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group relative ${
                                selectedTemplateId === tpl.id 
                                ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' 
                                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                            }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold truncate text-sm ${selectedTemplateId === tpl.id ? 'text-indigo-700' : 'text-slate-700'}`}>{tpl.name}</div>
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <LayoutTemplate size={10}/> {tpl.fields.length} alan
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all absolute right-2"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main: Form Builder */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Builder Header */}
                <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                    <div className="w-1/2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Şablon Adı</label>
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Örn: Standart Oda Özellikleri"
                            className="text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none w-full text-slate-800 placeholder:text-slate-300 transition-all py-1"
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={!formData.name.trim() || saveStatus === 'saving'}
                        className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[140px] justify-center ${
                            saveStatus === 'success' 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                    >
                        {saveStatus === 'saving' ? <Loader2 size={18} className="animate-spin" /> : 
                         saveStatus === 'success' ? <Check size={18} /> : 
                         <Save size={18} />}
                        
                        {saveStatus === 'saving' ? 'Kaydediliyor' : 
                         saveStatus === 'success' ? 'Kaydedildi' : 
                         'Kaydet'}
                    </button>
                </div>

                {/* Builder Canvas */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto space-y-4 pb-20">
                        
                        {formData.fields.length === 0 && (
                            <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-xl bg-white/50">
                                <LayoutTemplate size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-600">Şablonunuz Boş</h3>
                                <p className="text-slate-500 text-sm mb-6">Veri yapınızı oluşturmak için alan eklemeye başlayın.</p>
                                <button onClick={() => handleAddField('text')} className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                                    + İlk Alanı Ekle
                                </button>
                            </div>
                        )}

                        {formData.fields.map((field, index) => (
                            <div 
                                key={field.id} 
                                className={`bg-white p-5 rounded-xl border shadow-sm group transition-all relative ${draggedItemIndex === index ? 'opacity-50 border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200'}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="absolute left-2 top-6 text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500">
                                    <GripVertical size={20} />
                                </div>
                                
                                <div className="pl-8 grid grid-cols-12 gap-4 items-start">
                                    {/* Row 1: Basic Info */}
                                    <div className="col-span-2">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tip</label>
                                        <div className="relative">
                                            <button 
                                                onClick={() => setShowTypeSelector(showTypeSelector?.index === index ? null : { index })}
                                                className="w-full flex items-center gap-2 border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all"
                                            >
                                                {getTypeIcon(field.type)}
                                                <span className="truncate">{getTypeLabel(field.type)}</span>
                                            </button>
                                            
                                            {/* Type Dropdown */}
                                            {showTypeSelector?.index === index && showTypeSelector?.subIndex === undefined && (
                                                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-lg z-20 py-1 grid grid-cols-1 max-h-60 overflow-y-auto">
                                                    {(['text', 'textarea', 'number', 'boolean', 'select', 'multiselect', 'date', 'time', 'currency'] as FieldType[]).map(t => (
                                                        <button 
                                                            key={t} 
                                                            onClick={() => { handleUpdateField(field.id, { type: t }); setShowTypeSelector(null); }}
                                                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 text-left text-slate-700"
                                                        >
                                                            {getTypeIcon(t)} {getTypeLabel(t)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {showTypeSelector?.index === index && <div className="fixed inset-0 z-10" onClick={() => setShowTypeSelector(null)} />}
                                        </div>
                                    </div>

                                    <div className="col-span-5">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Etiket (Görünen İsim)</label>
                                        <LocalizedInput 
                                            value={field.label} 
                                            onChange={(val) => handleUpdateField(field.id, { label: val })} 
                                            placeholder="Örn: Yatak Tipi"
                                        />
                                    </div>

                                    <div className="col-span-3">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            Sistem Anahtarı <Info size={10} className="text-slate-300" title="Kod içinde kullanılacak ID" />
                                        </label>
                                        <input 
                                            type="text" 
                                            value={field.key}
                                            onChange={(e) => handleUpdateField(field.id, { key: e.target.value })}
                                            placeholder="bed_type"
                                            className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono text-slate-500 bg-slate-50 outline-none focus:bg-white focus:border-indigo-300 transition-colors"
                                        />
                                    </div>

                                    <div className="col-span-2 flex justify-end pt-6">
                                        <button onClick={() => handleDeleteField(field.id)} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Row 2: Advanced Options */}
                                    <div className="col-span-12 flex flex-col gap-4 pt-2 border-t border-slate-50 mt-2">
                                        
                                        <div className="flex items-start gap-4">
                                            {/* Select Options */}
                                            {(field.type === 'select' || field.type === 'multiselect') && (
                                                <div className="flex-1">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seçenekler (Virgülle Ayırın)</label>
                                                    <OptionsInput 
                                                        value={field.options} 
                                                        onChange={(opts) => handleUpdateField(field.id, { options: opts })} 
                                                    />
                                                </div>
                                            )}

                                            {/* AI Description */}
                                            <div className="flex-1">
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <BrainCircuit size={10} className="text-violet-500"/> AI Açıklaması (İpucu)
                                                </label>
                                                <input 
                                                    type="text" 
                                                    value={field.aiDescription || ''}
                                                    onChange={(e) => handleUpdateField(field.id, { aiDescription: e.target.value })}
                                                    placeholder="Örn: Odanın maksimum yetişkin kapasitesi"
                                                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-violet-300 bg-violet-50/30 text-violet-800 placeholder:text-violet-300"
                                                />
                                            </div>

                                            {/* Required Toggle */}
                                            <div className="pt-6">
                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={field.required}
                                                        onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">Zorunlu</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* CONDITIONAL SUB FIELDS (Only for boolean) */}
                                        {field.type === 'boolean' && (
                                            <div className="mt-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                                {!field.condition ? (
                                                    <button 
                                                        onClick={() => handleToggleCondition(field.id, true)}
                                                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <GitMerge size={14} /> Alt Soru Ekle (Koşullu Alanlar)
                                                    </button>
                                                ) : (
                                                    <div className="p-3">
                                                        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                                            <div className="flex items-center gap-2">
                                                                <GitMerge size={14} className="text-purple-500" />
                                                                <span className="text-xs font-bold text-slate-700">Alt Sorular</span>
                                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Tetikleyici: EVET (True)</span>
                                                            </div>
                                                            <button onClick={() => handleToggleCondition(field.id, false)} className="text-slate-400 hover:text-red-500 p-1">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>

                                                        {/* Sub Fields List */}
                                                        <div className="space-y-3 pl-2 border-l-2 border-purple-100 ml-1">
                                                            {field.condition.fields.map((sub, subIdx) => (
                                                                <div key={sub.id} className="bg-white p-3 rounded border border-slate-200 flex gap-3 items-start">
                                                                    <div className="pt-2 text-slate-300"><div className="w-2 h-2 rounded-full bg-purple-300"></div></div>
                                                                    
                                                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                                                        {/* Sub Label */}
                                                                        <div>
                                                                            <label className="block text-[9px] text-slate-400 font-bold mb-1">Soru</label>
                                                                            <LocalizedInput 
                                                                                value={sub.label} 
                                                                                onChange={(val) => handleUpdateSubField(field.id, sub.id, { label: val })} 
                                                                                placeholder="Örn: Tipi Nedir?"
                                                                            />
                                                                        </div>
                                                                        {/* Sub Type & Key */}
                                                                        <div className="flex gap-2">
                                                                            <div className="flex-1">
                                                                                <label className="block text-[9px] text-slate-400 font-bold mb-1">Tip</label>
                                                                                <div className="relative">
                                                                                    <button 
                                                                                        onClick={() => setShowTypeSelector(showTypeSelector?.index === index && showTypeSelector.subIndex === subIdx ? null : { index, subIndex: subIdx })}
                                                                                        className="w-full flex items-center gap-1 border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-600 bg-slate-50"
                                                                                    >
                                                                                        {getTypeIcon(sub.type)}
                                                                                        <span className="truncate">{getTypeLabel(sub.type)}</span>
                                                                                    </button>
                                                                                    {showTypeSelector?.index === index && showTypeSelector.subIndex === subIdx && (
                                                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-lg z-30 py-1 grid grid-cols-1 max-h-48 overflow-y-auto">
                                                                                            {(['text', 'select', 'multiselect', 'number'] as FieldType[]).map(t => (
                                                                                                <button 
                                                                                                    key={t} 
                                                                                                    onClick={() => { handleUpdateSubField(field.id, sub.id, { type: t }); setShowTypeSelector(null); }}
                                                                                                    className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 text-left text-slate-700"
                                                                                                >
                                                                                                    {getTypeIcon(t)} {getTypeLabel(t)}
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                    {showTypeSelector?.index === index && showTypeSelector.subIndex === subIdx && <div className="fixed inset-0 z-20" onClick={() => setShowTypeSelector(null)} />}
                                                                                </div>
                                                                            </div>
                                                                            <button onClick={() => handleDeleteSubField(field.id, sub.id)} className="mt-5 text-slate-300 hover:text-red-500"><X size={14}/></button>
                                                                        </div>
                                                                        
                                                                        {/* Sub Options (if select) */}
                                                                        {(sub.type === 'select' || sub.type === 'multiselect') && (
                                                                            <div className="col-span-2">
                                                                                <label className="block text-[9px] text-slate-400 font-bold mb-1">Seçenekler</label>
                                                                                <OptionsInput value={sub.options} onChange={(opts) => handleUpdateSubField(field.id, sub.id, { options: opts })} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            
                                                            <button 
                                                                onClick={() => handleAddSubField(field.id)}
                                                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-bold px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                                                            >
                                                                <Plus size={12} /> Alt Alan Ekle
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Add Field Bar */}
                        <div className="grid grid-cols-5 gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200">
                            {(['text', 'number', 'boolean', 'select', 'multiselect', 'date', 'time', 'currency', 'textarea'] as FieldType[]).map(type => (
                                <button 
                                    key={type}
                                    onClick={() => handleAddField(type)}
                                    className="flex flex-col items-center justify-center gap-1 py-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all text-slate-500"
                                >
                                    {getTypeIcon(type)}
                                    <span className="text-[10px] font-bold">{getTypeLabel(type)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;


import React, { useState, useEffect } from 'react';
import { NodeTemplate, TemplateField, LocalizedText } from '../types';
import { useHotel } from '../contexts/HotelContext';
import { generateId } from '../utils/treeUtils';
import { X, Plus, Trash2, Save, LayoutTemplate, GripVertical, Check, Info } from 'lucide-react';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyTemplate: NodeTemplate = {
    id: '',
    name: '',
    fields: []
};

// Reuse a simple version of LocalizedInput locally to avoid circular deps or complex refactors
const LocalizedInput: React.FC<{
    value: LocalizedText;
    onChange: (val: LocalizedText) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
    return (
        <div className="flex gap-2">
            <input 
                type="text" 
                value={value.tr}
                onChange={(e) => onChange({ ...value, tr: e.target.value })}
                placeholder={`${placeholder} (TR)`}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500 outline-none"
            />
            <input 
                type="text" 
                value={value.en}
                onChange={(e) => onChange({ ...value, en: e.target.value })}
                placeholder={`${placeholder} (EN)`}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:border-indigo-500 outline-none bg-slate-50"
            />
        </div>
    );
};

const TemplateManager: React.FC<TemplateManagerProps> = ({ isOpen, onClose }) => {
  const { nodeTemplates, addNodeTemplate, updateNodeTemplate, deleteNodeTemplate } = useHotel();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NodeTemplate>(emptyTemplate);

  // Initialize create mode
  useEffect(() => {
    if (isOpen && !selectedTemplateId) {
        setFormData({ ...emptyTemplate, id: generateId('tpl') });
    }
  }, [isOpen, selectedTemplateId]);

  const handleSelect = (tpl: NodeTemplate) => {
      setSelectedTemplateId(tpl.id);
      setFormData(JSON.parse(JSON.stringify(tpl))); // Deep copy
  };

  const handleCreateNew = () => {
      setSelectedTemplateId(null);
      setFormData({ ...emptyTemplate, id: generateId('tpl') });
  };

  const handleAddField = () => {
      const newField: TemplateField = {
          id: generateId('fld'),
          key: '',
          label: { tr: '', en: '' },
          type: 'text',
          required: false
      };
      setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
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

  const handleSave = async () => {
      if (!formData.name.trim()) return;
      // Generate keys if missing
      const processedFields = formData.fields.map(f => ({
          ...f,
          key: f.key || f.label.en.toLowerCase().replace(/\s+/g, '_') || generateId('k')
      }));
      
      const finalData = { ...formData, fields: processedFields };

      if (selectedTemplateId) {
          await updateNodeTemplate(finalData);
      } else {
          await addNodeTemplate(finalData);
      }
      setSelectedTemplateId(finalData.id);
  };

  const handleDeleteTemplate = async (id: string) => {
      if (!window.confirm("Delete this template?")) return;
      await deleteNodeTemplate(id);
      if (selectedTemplateId === id) handleCreateNew();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-white/20 p-2 rounded-lg">
               <LayoutTemplate size={24} />
            </div>
            <div>
               <h2 className="text-xl font-bold">Dynamic Template Manager</h2>
               <p className="text-white/80 text-sm">Create standard data forms for your items (e.g. Room Types, Food Menus).</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar: Template List */}
            <div className="w-1/4 bg-slate-50 border-r border-slate-200 flex flex-col min-w-[250px]">
                <div className="p-4 border-b border-slate-200">
                    <button 
                        onClick={handleCreateNew}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> New Template
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {nodeTemplates.length === 0 && (
                        <div className="text-center p-6 text-slate-400 text-sm italic">No templates defined yet.</div>
                    )}
                    {nodeTemplates.map(tpl => (
                        <div 
                            key={tpl.id}
                            onClick={() => handleSelect(tpl)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${
                                selectedTemplateId === tpl.id 
                                ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-100' 
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-700 truncate">{tpl.name}</div>
                                <div className="text-xs text-slate-500 truncate">{tpl.fields.length} fields</div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main: Form Builder */}
            <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                    <div>
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Template Name (e.g. Room Features)"
                            className="text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full text-slate-800 placeholder:text-slate-400"
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={!formData.name.trim()}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} /> Save Template
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                    <div className="max-w-4xl mx-auto space-y-4">
                        
                        {formData.fields.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-slate-100/50">
                                <LayoutTemplate size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-500 font-medium">Start adding fields to build your form.</p>
                                <button onClick={handleAddField} className="mt-4 text-indigo-600 font-bold hover:underline">Add First Field</button>
                            </div>
                        )}

                        {formData.fields.map((field, index) => (
                            <div key={field.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-start group">
                                <div className="mt-2 text-slate-300 cursor-move"><GripVertical size={20} /></div>
                                
                                <div className="flex-1 grid grid-cols-12 gap-4">
                                    <div className="col-span-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Label (TR / EN)</label>
                                        <LocalizedInput 
                                            value={field.label} 
                                            onChange={(val) => handleUpdateField(field.id, { label: val })} 
                                            placeholder="Field Name"
                                        />
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</label>
                                        <select 
                                            value={field.type}
                                            onChange={(e) => handleUpdateField(field.id, { type: e.target.value as any })}
                                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Yes/No</option>
                                            <option value="select">Select (Dropdown)</option>
                                        </select>
                                    </div>

                                    <div className="col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Key (Auto)</label>
                                        <input 
                                            type="text" 
                                            value={field.key}
                                            onChange={(e) => handleUpdateField(field.id, { key: e.target.value })}
                                            placeholder="internal_key"
                                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono text-slate-500 bg-slate-50 outline-none"
                                        />
                                    </div>

                                    <div className="col-span-3 flex items-center gap-4 mt-5">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={field.required} 
                                                onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs font-medium text-slate-600">Required</span>
                                        </label>
                                        <button onClick={() => handleDeleteField(field.id)} className="text-slate-300 hover:text-red-500 ml-auto p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {field.type === 'select' && (
                                        <div className="col-span-12 pt-2 border-t border-slate-100">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Options (Comma separated)</label>
                                            <input 
                                                type="text" 
                                                value={Array.isArray(field.options) ? field.options.join(',') : ''}
                                                onChange={(e) => handleUpdateField(field.id, { options: e.target.value.split(',') })}
                                                placeholder="Option 1, Option 2, Option 3"
                                                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <button 
                            onClick={handleAddField}
                            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add New Field
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;


import React, { useState, useEffect } from 'react';
import { AIPersona } from '../types';
import { useHotel } from '../contexts/HotelContext';
import { generateId } from '../utils/treeUtils';
import { X, User, Plus, Trash2, Check, Save, Bot, MessageSquare } from 'lucide-react';

interface AIPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyPersona: AIPersona = {
    id: '',
    name: '',
    role: '',
    tone: '',
    languageStyle: '',
    instructions: [],
    creativity: 0.7
};

const AIPersonaModal: React.FC<AIPersonaModalProps> = ({ isOpen, onClose }) => {
  const { personas, addPersona, updatePersona, deletePersona } = useHotel();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AIPersona>(emptyPersona);
  const [newRule, setNewRule] = useState('');

  // Reset form when opening or switching to create mode
  useEffect(() => {
    if (isOpen && !editingId) {
        setFormData({ ...emptyPersona, id: generateId('persona') });
    }
  }, [isOpen, editingId]);

  if (!isOpen) return null;

  const handleSelect = (p: AIPersona) => {
      setEditingId(p.id);
      setFormData({ ...p });
  };

  const handleCreateNew = () => {
      setEditingId(null);
      setFormData({ ...emptyPersona, id: generateId('persona') });
  };

  const handleChange = (field: keyof AIPersona, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddRule = () => {
      if (!newRule.trim()) return;
      setFormData(prev => ({ ...prev, instructions: [...prev.instructions, newRule.trim()] }));
      setNewRule('');
  };

  const handleRemoveRule = (idx: number) => {
      setFormData(prev => ({ ...prev, instructions: prev.instructions.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
      if (!formData.name.trim()) return;
      
      if (editingId) {
          await updatePersona(formData);
      } else {
          await addPersona(formData);
      }
      // Stay on the form but switch to edit mode of the new item
      setEditingId(formData.id);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("Are you sure?")) return;
      await deletePersona(id);
      if (editingId === id) handleCreateNew();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-white/20 p-2 rounded-lg">
               <Bot size={24} />
            </div>
            <div>
               <h2 className="text-xl font-bold">AI Identity Designer</h2>
               <p className="text-white/80 text-sm">Create specific personas (e.g. Sales, Reception) to test your data.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar List */}
            <div className="w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200">
                    <button 
                        onClick={handleCreateNew}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Create New Persona
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {personas.length === 0 && (
                        <div className="text-center p-6 text-slate-400 text-sm">No personas yet. Create one to get started.</div>
                    )}
                    {personas.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => handleSelect(p)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${
                                editingId === p.id 
                                ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-100' 
                                : 'bg-white border-slate-200 hover:border-emerald-300'
                            }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-700 truncate">{p.name}</div>
                                <div className="text-xs text-slate-500 truncate">{p.role}</div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor Form */}
            <div className="flex-1 bg-white flex flex-col overflow-y-auto">
                <div className="p-8 max-w-2xl mx-auto w-full space-y-6">
                    
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">
                            {editingId ? 'Edit Persona' : 'New Persona'}
                        </h3>
                        {editingId && <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">ID: {editingId}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Persona Name</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="e.g. Aggressive Sales Agent"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role / Title</label>
                            <input 
                                type="text" 
                                value={formData.role}
                                onChange={(e) => handleChange('role', e.target.value)}
                                placeholder="e.g. Senior Manager"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tone & Voice</label>
                        <input 
                            type="text" 
                            value={formData.tone}
                            onChange={(e) => handleChange('tone', e.target.value)}
                            placeholder="e.g. Professional, Persuasive, Urgent, Helpful"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Adjectives defining how the AI should sound.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Language Style</label>
                        <input 
                            type="text" 
                            value={formData.languageStyle}
                            onChange={(e) => handleChange('languageStyle', e.target.value)}
                            placeholder="e.g. Formal Turkish, Casual English, Technical"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Behavior Rules (Instructions)</label>
                        <div className="space-y-2 mb-3">
                            {formData.instructions.map((rule, idx) => (
                                <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded border border-slate-200 text-sm text-slate-700">
                                    <span className="text-emerald-500 mt-0.5">•</span>
                                    <span className="flex-1">{rule}</span>
                                    <button onClick={() => handleRemoveRule(idx)} className="text-slate-400 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {formData.instructions.length === 0 && <div className="text-xs text-slate-400 italic">No specific rules added yet.</div>}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
                                placeholder="e.g. Never mention competitor prices..."
                                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <button onClick={handleAddRule} className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Creativity (Temperature)</label>
                            <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{formData.creativity.toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.1"
                            value={formData.creativity}
                            onChange={(e) => handleChange('creativity', parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>Strict / Factual</span>
                            <span>Creative / Random</span>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button 
                            onClick={handleSave}
                            disabled={!formData.name.trim()}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save size={18} /> Save Persona
                        </button>
                    </div>

                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AIPersonaModal;

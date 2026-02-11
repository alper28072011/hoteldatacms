
import React, { useState } from 'react';
import { HotelNode } from '../types';
import { saveTemplate } from '../services/firestoreService';
import { X, Save, Check, CircleAlert, Loader2 } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose, data }) => {
  const [name, setName] = useState(data.name || '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setStatus('idle');
    
    try {
      await saveTemplate({
        name,
        description,
        data: data, // We save the snapshot
        createdAt: Date.now()
      });
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 1500);
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-6 flex justify-between items-start">
           <div>
              <h2 className="text-xl font-bold text-white">Save as Template</h2>
              <p className="text-pink-100 text-sm mt-1">Create a reusable blueprint from this hotel.</p>
           </div>
           <button onClick={onClose} className="text-white/60 hover:text-white">
              <X size={24} />
           </button>
        </div>

        <div className="p-6 space-y-4">
           <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Template Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none"
                placeholder="e.g. 5-Star Resort Schema"
              />
           </div>
           
           <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 outline-none h-24 resize-none"
                placeholder="Describe what this template contains (e.g. Includes full spa menu and room types)..."
              />
           </div>

           {status === 'success' && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg text-sm">
                 <Check size={16} /> Template saved successfully!
              </div>
           )}

           {status === 'error' && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                 <CircleAlert size={16} /> Failed to save template.
              </div>
           )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
           <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">
              Cancel
           </button>
           <button 
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
           >
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />}
              Save Template
           </button>
        </div>

      </div>
    </div>
  );
};

export default TemplateModal;

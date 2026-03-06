import React, { useState, useEffect } from 'react';
import { HotelNode, HotelTemplate } from '../types';
import { getTemplatesList } from '../services/firestoreService';
import { X, Copy, LayoutTemplate, FilePlus, Check, Loader2, ArrowRight } from 'lucide-react';

interface CreateHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, templateData?: HotelNode, isStructureOnly?: boolean) => void;
}

const CreateHotelModal: React.FC<CreateHotelModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [hotelName, setHotelName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<HotelTemplate | null>(null);
  const [templates, setTemplates] = useState<HotelTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isStructureOnly, setIsStructureOnly] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setHotelName('');
      setSelectedTemplate(null);
      setIsStructureOnly(false);
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const list = await getTemplatesList();
      setTemplates(list);
    } catch (e) {
      console.error("Failed to load templates", e);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCreate = () => {
    if (!hotelName.trim()) return;
    onCreate(hotelName, selectedTemplate?.data, isStructureOnly);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Create New Hotel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          {/* Hotel Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Hotel Name</label>
            <input 
              type="text" 
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="e.g. Grand Horizon Resort"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
              autoFocus
            />
          </div>

          <div className="space-y-4">
             <label className="block text-sm font-semibold text-slate-700">Choose Starting Point</label>
             
             {/* Option 1: Scratch */}
             <button 
                onClick={() => setSelectedTemplate(null)}
                className={`w-full flex items-center p-4 border rounded-xl text-left transition-all ${
                  selectedTemplate === null 
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
             >
                <div className={`p-3 rounded-full mr-4 ${selectedTemplate === null ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                   <FilePlus size={20} />
                </div>
                <div>
                   <div className="font-semibold text-slate-800">Start from Scratch</div>
                   <div className="text-xs text-slate-500 mt-1">Empty project with basic structure</div>
                </div>
                {selectedTemplate === null && <Check size={18} className="ml-auto text-blue-600" />}
             </button>

             {/* Option 2: Templates */}
             <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Available Templates</div>
                
                {isLoadingTemplates ? (
                   <div className="flex justify-center py-4 text-slate-400">
                      <Loader2 size={24} className="animate-spin" />
                   </div>
                ) : templates.length === 0 ? (
                   <div className="text-sm text-slate-400 italic px-4 py-2 bg-slate-50 rounded border border-dashed border-slate-200">
                     No templates saved yet. Save a hotel as a template to see it here.
                   </div>
                ) : (
                   <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {templates.map(tpl => (
                         <button 
                            key={tpl.id}
                            onClick={() => setSelectedTemplate(tpl)}
                            className={`w-full flex items-center p-3 border rounded-lg text-left transition-all ${
                              selectedTemplate?.id === tpl.id
                                ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' 
                                : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                            }`}
                         >
                            <div className={`p-2 rounded-full mr-3 ${selectedTemplate?.id === tpl.id ? 'bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                               <LayoutTemplate size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="font-medium text-slate-800 truncate">{tpl.name}</div>
                               <div className="text-[10px] text-slate-500 truncate">{tpl.description || 'No description'}</div>
                            </div>
                            {selectedTemplate?.id === tpl.id && <Check size={16} className="ml-auto text-violet-600" />}
                         </button>
                      ))}
                   </div>
                )}
             </div>

             {/* Template Options */}
             {selectedTemplate && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                   <label className="flex items-start cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isStructureOnly}
                        onChange={(e) => setIsStructureOnly(e.target.checked)}
                        className="mt-1 rounded text-blue-600 focus:ring-blue-500" 
                      />
                      <div className="ml-3">
                         <span className="block text-sm font-medium text-slate-800">Import Structure Only</span>
                         <span className="block text-xs text-slate-500 mt-0.5">
                            Keeps categories and fields, but removes specific values (prices, hours, descriptions). Perfect for reusing a schema.
                         </span>
                      </div>
                   </label>
                </div>
             )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
           </button>
           <button 
              onClick={handleCreate}
              disabled={!hotelName.trim()}
              className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
           >
              Create Hotel <ArrowRight size={16} />
           </button>
        </div>

      </div>
    </div>
  );
};

export default CreateHotelModal;
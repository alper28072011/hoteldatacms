// ... (top imports)
import React, { useState, useEffect } from 'react';
import { X, Cpu, Database, Save, RotateCcw, CalendarClock } from 'lucide-react';
import { 
  availableModels, 
  currentModel, 
  setModel, 
  totalTokensUsed, 
  subscribeToTokens, 
  subscribeToModelChange 
} from '../services/geminiService';
import { getTokenUsageLogs } from '../services/firestoreService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [tokens, setTokens] = useState(totalTokensUsed);
  const [dbLogs, setDbLogs] = useState<{date: string, model: string, tokens: number}[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setSelectedModel(currentModel);
    setTokens(totalTokensUsed);

    const unsubTokens = subscribeToTokens((newTotal) => {
      setTokens(newTotal);
    });

    const unsubModel = subscribeToModelChange((newModel) => {
      setSelectedModel(newModel);
    });

    if (isOpen) {
       setLoadingLogs(true);
       getTokenUsageLogs().then(logs => {
         setDbLogs(logs);
         setLoadingLogs(false);
       }).catch(err => {
         console.error(err);
         setLoadingLogs(false);
       });
    }

    return () => {
      unsubTokens();
      unsubModel();
    };
  }, [isOpen]);

  const handleSave = () => {
    setModel(selectedModel);
    onClose();
  };

  const getModelName = (id: string) => {
     return availableModels.find(m => m.id === id)?.name || id;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg">
                <Cpu size={20} />
             </div>
             <div>
                <h3 className="text-xl font-semibold text-gray-900">Uygulama Ayarları</h3>
                <p className="text-sm text-gray-500">Gemini modellerini ve sistem özelliklerini yönetin.</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           
           {/* Model Selection */}
           <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Yapay Zeka Modeli</label>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <select
                    className="w-full form-select rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                 >
                    {availableModels.map(m => (
                       <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                 </select>
                 <p className="mt-3 text-xs text-gray-500">
                   Seçtiğiniz model, uygulamanın tüm özelliklerinde (analiz, veri doldurma, sohbet, öneriler vb.) kullanılacaktır.
                 </p>
              </div>
           </div>

           {/* Token Analytics */}
           <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Veritabanı Kayıtlı Token Tüketimi</label>
              
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                    <tr>
                       <th className="px-4 py-3">Tarih</th>
                       <th className="px-4 py-3">Model</th>
                       <th className="px-4 py-3 text-right">Tüketilen Token</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {loadingLogs ? (
                      <tr><td colSpan={3} className="text-center py-6 text-gray-400">Yükleniyor...</td></tr>
                    ) : dbLogs.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-6 text-gray-400">Veritabanında henüz kayıt bulunmuyor.</td></tr>
                    ) : (
                       dbLogs.map((log, idx) => (
                         <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                           <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700 flex flex-col">
                             <span>{new Date(log.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric'})}</span>
                           </td>
                           <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                <Cpu size={12} />
                                {getModelName(log.model)}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-right text-gray-900 font-mono">
                             {log.tokens.toLocaleString('tr-TR')}
                           </td>
                         </tr>
                       ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Bu istatistikler arka planda merkezi veritabanına işlenerek gün gün saklanmaktadır.
              </p>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            İptal
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 flex items-center gap-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
          >
            <Save size={18} />
            Kaydet
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;

import React, { useState, useEffect } from 'react';
import { X, Cpu, Database, Save, RotateCcw, CalendarClock, Key, Eye, EyeOff, ShieldCheck, Layers, Settings, Loader2 } from 'lucide-react';
import { 
  availableModels, 
  currentModel, 
  setModel, 
  totalTokensUsed, 
  subscribeToTokens, 
  subscribeToModelChange,
  activeConfig,
  updateActiveGeminiConfig
} from '../services/geminiService';
import { getTokenUsageLogs, getGeminiConfig, saveGeminiConfig } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { GeminiConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { userRole } = useAuth();
  const isSuperAdmin = userRole === 'superadmin';

  // --- Normal Settings State ---
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [tokens, setTokens] = useState(totalTokensUsed);
  const [dbLogs, setDbLogs] = useState<{date: string, model: string, tokens: number}[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // --- Super Admin State ---
  const [customApiKey, setCustomApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['superadmin', 'editor']);
  const [modularModels, setModularModels] = useState({
    translation: 'gemini-2.5-flash',
    optimization: 'gemini-2.5-flash',
    architect: 'gemini-2.5-pro',
    health: 'gemini-2.5-flash',
    chat: 'gemini-2.5-flash'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'modular' | 'logs'>('general');

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

       // Load secure Gemini configuration for Super Admin
       if (isSuperAdmin) {
         setConfigLoading(true);
         getGeminiConfig().then(config => {
           if (config) {
             setCustomApiKey(config.apiKey || '');
             setAllowedRoles(config.allowedRoles || ['superadmin', 'editor']);
             if (config.models) {
               setModularModels({
                 translation: config.models.translation || 'gemini-2.5-flash',
                 optimization: config.models.optimization || 'gemini-2.5-flash',
                 architect: config.models.architect || 'gemini-2.5-pro',
                 health: config.models.health || 'gemini-2.5-flash',
                 chat: config.models.chat || 'gemini-2.5-flash'
               });
             }
           }
           setConfigLoading(false);
         }).catch(err => {
           console.error("Config fetch failed", err);
           setConfigLoading(false);
         });
       }
    }

    return () => {
      unsubTokens();
      unsubModel();
    };
  }, [isOpen, isSuperAdmin]);

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      if (isSuperAdmin) {
        const newConfig: GeminiConfig = {
          apiKey: customApiKey.trim(),
          allowedRoles: allowedRoles,
          models: modularModels
        };
        // 1. Save securely to Firestore
        await saveGeminiConfig(newConfig);
        // 2. Update local state reactively
        updateActiveGeminiConfig(newConfig);
      } else {
        // Normal user only saves default model
        setModel(selectedModel);
      }
      onClose();
    } catch (e) {
      console.error("Failed to save settings", e);
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleRolePermission = (role: string) => {
    if (role === 'superadmin') return; // Cannot disable superadmin
    if (allowedRoles.includes(role)) {
      setAllowedRoles(prev => prev.filter(r => r !== role));
    } else {
      setAllowedRoles(prev => [...prev, role]);
    }
  };

  const handleModularModelChange = (category: keyof typeof modularModels, modelId: string) => {
    setModularModels(prev => ({
      ...prev,
      [category]: modelId
    }));
  };

  const getModelName = (id: string) => {
     return availableModels.find(m => m.id === id)?.name || id;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white shadow-2xl rounded-2xl flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl">
                <Cpu size={20} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-900">Uygulama & Yapay Zeka Ayarları</h3>
                <p className="text-sm text-slate-500">
                  {isSuperAdmin ? "Yapay zeka erişim, API anahtarı ve modüler model yetkilendirmesini yönetin." : "Gemini yapay zeka modellerini ve sistem özelliklerini inceleyin."}
                </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Super Admin Navigation Tabs */}
        {isSuperAdmin && (
          <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <ShieldCheck size={16} />
              Genel Yetki ve API Anahtarı
            </button>
            <button
              onClick={() => setActiveTab('modular')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'modular' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Layers size={16} />
              Modüler Model Seçimi
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <CalendarClock size={16} />
              Token Tüketim Analizleri
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {configLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500 font-medium">Sistem ayarları yükleniyor...</p>
            </div>
          ) : (
            <>
              {/* --- TAB 1: GENERAL & ACCESS --- */}
              {(!isSuperAdmin || activeTab === 'general') && (
                <div className="space-y-6">
                  {/* Super Admin API Key Entry */}
                  {isSuperAdmin ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Key size={16} className="text-indigo-600" />
                        Gemini Yapay Zeka API Anahtarı
                      </label>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                        <div className="relative rounded-md shadow-sm">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            className="w-full pr-10 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-slate-800 text-sm py-2 px-3"
                            placeholder="AIzaSy..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Webde yayınlanan sürümün yapay zeka özelliklerini (otomatik tamamlama, koçluk, çeviri) kullanabilmesi için bir API anahtarı girin. Bu anahtar veritabanında <strong>güvenli bir şekilde</strong> şifreli saklanacak ve istemci tarafında doğrudan açığa çıkmayacaktır.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Normal Model Selection for editors */
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-700">Yapay Zeka Modeli</label>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                         <select
                            className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                         >
                            {availableModels.map(m => (
                               <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                         </select>
                         <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                           Seçtiğiniz model, yetkileriniz dahilinde sistemin tüm yapay zeka entegrasyonlarında varsayılan olarak kullanılacaktır.
                         </p>
                      </div>
                    </div>
                  )}

                  {/* Super Admin Access Control */}
                  {isSuperAdmin && (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        Yapay Zeka Özelliklerini Kimler Kullanabilir?
                      </label>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <div>
                            <span className="block text-sm font-bold text-slate-800">Süper Admin Rolü</span>
                            <span className="text-xs text-slate-500">Sistem yöneticileri her zaman yapay zeka özelliklerini kullanabilir.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={true}
                            disabled={true}
                            className="h-4.5 w-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <div>
                            <span className="block text-sm font-bold text-slate-800">Editör Rolü</span>
                            <span className="text-xs text-slate-500">Editörlerin yapay zeka yardımcılarını (çeviri, otomatik doldurma, veri koçu) kullanmasına izin ver.</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={allowedRoles.includes('editor')}
                            onChange={() => toggleRolePermission('editor')}
                            className="h-4.5 w-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- TAB 2: MODULAR MODEL SELECTION --- */}
              {isSuperAdmin && activeTab === 'modular' && (
                <div className="space-y-6">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100/80 rounded-xl">
                    <p className="text-xs text-indigo-700 leading-relaxed font-medium flex items-center gap-2">
                      <Layers size={14} />
                      Uygulamanın farklı alanlarında gerçekleştirilen yapay zeka işlemleri için farklı modeller atayabilirsiniz. Böylece bütçe ve hız optimizasyonunu tamamen kontrol edebilirsiniz.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Translation Model */}
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Çeviri & Yerelleştirme</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.translation}
                        onChange={(e) => handleModularModelChange('translation', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Otel alanları ve özelliklerin Türkçe/İngilizce dil çevirilerinde kullanılır.
                      </span>
                    </div>

                    {/* Optimization Model */}
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Metin & Alan Optimizasyonu</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.optimization}
                        onChange={(e) => handleModularModelChange('optimization', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        İçerik iyileştirme, başlık optimizasyonları ve ID eşleşmeleri üretiminde kullanılır.
                      </span>
                    </div>

                    {/* AI Architect Model */}
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Yapay Zeka Mimar (Structure)</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.architect}
                        onChange={(e) => handleModularModelChange('architect', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Doğal dille otel yapısını oluşturma ve karmaşık ağaç manipülasyonlarında kullanılır.
                      </span>
                    </div>

                    {/* Health & QC Model */}
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Sağlık Analizi & QC</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.health}
                        onChange={(e) => handleModularModelChange('health', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Veritabanı kalitesini denetleme, tutarsızlıkları bulma ve otomatik temizlik önerilerinde kullanılır.
                      </span>
                    </div>

                    {/* Data Coach & Simulation Model */}
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2 md:col-span-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Veri Koçu & Simülasyon Sohbeti</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.chat}
                        onChange={(e) => handleModularModelChange('chat', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        ChatBot simülatörü ve sistem danışmanı ile kullanıcı sohbetlerinde kullanılır.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 3: TOKEN LOGS --- */}
              {(!isSuperAdmin || activeTab === 'logs') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-800">Veritabanı Kayıtlı Token Tüketimi</label>
                    <span className="text-xs font-medium text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/50">
                      Toplam: {tokens.toLocaleString('tr-TR')} tkn
                    </span>
                  </div>
                  
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200/80 text-xs uppercase font-bold text-slate-500 sticky top-0 z-10">
                          <tr>
                             <th className="px-4 py-3 bg-slate-50">Tarih</th>
                             <th className="px-4 py-3 bg-slate-50">Model</th>
                             <th className="px-4 py-3 bg-slate-50 text-right">Tüketilen Token</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {loadingLogs ? (
                            <tr><td colSpan={3} className="text-center py-10 text-slate-400 font-medium"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />Yükleniyor...</td></tr>
                          ) : dbLogs.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-10 text-slate-400 font-medium">Veritabanında henüz kayıt bulunmuyor.</td></tr>
                          ) : (
                             dbLogs.map((log, idx) => (
                               <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                                   {new Date(log.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric'})}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                      <Cpu size={12} />
                                      {getModelName(log.model)}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3 text-right text-slate-900 font-mono font-semibold">
                                   {log.tokens.toLocaleString('tr-TR')}
                                 </td>
                               </tr>
                             ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-normal">
                    Bu istatistikler, uygulamanın arka planda merkezi veritabanı (Firestore) üzerine işlediği token tüketim logs kaydı üzerinden gün gün saklanmaktadır.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-3 shrink-0">
          <button 
            disabled={saveLoading}
            onClick={onClose}
            className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-200/60 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            İptal
          </button>
          <button 
            disabled={saveLoading || configLoading}
            onClick={handleSave}
            className="px-5 py-2 flex items-center gap-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-lg transition-colors shadow-sm text-sm disabled:opacity-50"
          >
            {saveLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save size={16} />
                Kaydet
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;

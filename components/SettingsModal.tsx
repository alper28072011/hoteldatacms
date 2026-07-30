import React, { useState, useEffect } from 'react';
import { X, Cpu, Database, Save, RotateCcw, CalendarClock, Key, Eye, EyeOff, ShieldCheck, Layers, Settings, Loader2, Users, Shield } from 'lucide-react';
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
import { getTokenUsageLogs, getGeminiConfig, saveGeminiConfig, getAllUserRoles, saveUserRole } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { GeminiConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelsList?: { id: string; name: string }[];
  initialTab?: 'general' | 'users' | 'modular' | 'logs';
}

interface UserRoleItem {
  email: string;
  role: 'superadmin' | 'editor';
  allowedHotels: string[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  hotelsList = [], 
  initialTab = 'general' 
}) => {
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
    chat: 'gemini-2.5-flash',
    coach: 'gemini-2.5-flash',
    simulator: 'gemini-2.5-flash'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'modular' | 'logs'>(initialTab);

  // --- User Management State ---
  const [userRolesList, setUserRolesList] = useState<UserRoleItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userSelectedRole, setUserSelectedRole] = useState<'superadmin' | 'editor'>('editor');
  const [userSelectedHotels, setUserSelectedHotels] = useState<string[]>([]);
  const [userEditing, setUserEditing] = useState(false);

  const fetchUsersList = async () => {
    setUsersLoading(true);
    try {
      const data = await getAllUserRoles();
      const sorted = [...data].sort((a, b) => a.email.localeCompare(b.email));
      setUserRolesList(sorted);
    } catch (e) {
      console.error("Failed to load user roles", e);
      setUserError("Kullanıcı rolleri yüklenirken bir hata oluştu.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
                 chat: config.models.chat || 'gemini-2.5-flash',
                 coach: config.models.coach || config.models.chat || 'gemini-2.5-flash',
                 simulator: config.models.simulator || config.models.chat || 'gemini-2.5-flash'
               });
             }
           }
           setConfigLoading(false);
         }).catch(err => {
           console.error("Config fetch failed", err);
           setConfigLoading(false);
         });

         // Also fetch user roles if superadmin
         fetchUsersList();
       }
    }

    return () => {
      unsubTokens();
      unsubModel();
    };
  }, [isOpen, isSuperAdmin]);

  const resetUserForm = () => {
    setUserEmailInput('');
    setUserSelectedRole('editor');
    setUserSelectedHotels([]);
    setUserEditing(false);
    setUserError(null);
    setUserSuccess(null);
  };

  const handleToggleUserHotel = (hotelId: string) => {
    setUserSelectedHotels(prev => 
      prev.includes(hotelId)
        ? prev.filter(id => id !== hotelId)
        : [...prev, hotelId]
    );
  };

  const handleEditUserRole = (user: UserRoleItem) => {
    setUserEmailInput(user.email);
    setUserSelectedRole(user.role);
    setUserSelectedHotels(user.allowedHotels);
    setUserEditing(true);
    setUserError(null);
    setUserSuccess(null);
  };

  const handleSaveUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmailInput) {
      setUserError('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    const emailClean = userEmailInput.trim().toLowerCase();
    if (emailClean === 'alper28072011@gmail.com') {
      setUserError('Bu superadmin kullanıcısının yetkileri değiştirilemez.');
      return;
    }

    setUserSaving(true);
    setUserError(null);
    setUserSuccess(null);

    try {
      await saveUserRole(emailClean, userSelectedRole, userSelectedRole === 'superadmin' ? [] : userSelectedHotels);
      setUserSuccess(userEditing ? 'Kullanıcı yetkileri güncellendi.' : 'Yeni kullanıcı yetkileri kaydedildi.');
      resetUserForm();
      await fetchUsersList();
    } catch (e: any) {
      console.error(e);
      setUserError('Kaydedilirken bir hata oluştu: ' + (e.message || 'Bilinmeyen hata'));
    } finally {
      setUserSaving(false);
    }
  };

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
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-2xl flex flex-col h-[680px] max-h-[90vh] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed Height */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
             <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                <Settings size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Ayarlar ve Kullanıcı Yönetimi</h3>
                <p className="text-xs text-slate-500">
                  {isSuperAdmin ? "Uygulama ayarlarını, yapay zeka modellerini ve kullanıcı yetkilerini yönetin." : "Gemini yapay zeka modellerini ve sistem ayarlarını inceleyin."}
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

        {/* Navigation Tabs - Fixed Height */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <ShieldCheck size={16} />
            Genel & API Anahtarı
          </button>
          
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Users size={16} />
              Kullanıcı Yönetimi
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('modular')}
              className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'modular' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Layers size={16} />
              Modüler Modeller
            </button>
          )}

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <CalendarClock size={16} />
            Token Analizleri
          </button>
        </div>

        {/* Tab Content Container - Fills exact remaining height without resizing */}
        <div className="flex-1 overflow-hidden relative">
          {configLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500 font-medium">Sistem ayarları yükleniyor...</p>
            </div>
          ) : (
            <>
              {/* --- TAB 1: GENERAL & ACCESS --- */}
              {activeTab === 'general' && (
                <div className="h-full overflow-y-auto p-6 space-y-6">
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

              {/* --- TAB 2: USER MANAGEMENT --- */}
              {isSuperAdmin && activeTab === 'users' && (
                <div className="h-full flex flex-col md:grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
                  
                  {/* Left Column: Form */}
                  <div className="p-5 md:col-span-2 overflow-y-auto space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {userEditing ? 'Yetki Düzenle' : 'Yeni Kullanıcı Yetkilendir'}
                    </h4>

                    {userError && (
                      <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-medium">
                        {userError}
                      </div>
                    )}

                    {userSuccess && (
                      <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-lg text-xs font-medium">
                        {userSuccess}
                      </div>
                    )}

                    <form onSubmit={handleSaveUserRole} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Kullanıcı E-posta</label>
                        <input
                          type="email"
                          required
                          disabled={userEditing}
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 bg-white"
                          placeholder="user@example.com"
                          value={userEmailInput}
                          onChange={(e) => setUserEmailInput(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Sistem Rolü</label>
                        <select
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          value={userSelectedRole}
                          onChange={(e) => setUserSelectedRole(e.target.value as 'superadmin' | 'editor')}
                        >
                          <option value="editor">Editor (Otel Seviyesinde Kısıtlı)</option>
                          <option value="superadmin">Superadmin (Tam Yetkili)</option>
                        </select>
                      </div>

                      {userSelectedRole === 'editor' && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-slate-700">Yetkili Oteller</label>
                          <div className="border border-slate-200 rounded-lg p-2.5 max-h-[160px] overflow-y-auto space-y-1.5 bg-slate-50/50">
                            {hotelsList.length === 0 ? (
                              <p className="text-xs text-slate-400">Sistemde henüz kayıtlı otel bulunmamaktadır.</p>
                            ) : (
                              hotelsList.map(hotel => (
                                <label key={hotel.id} className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer p-1 rounded hover:bg-white transition-colors">
                                  <input
                                    type="checkbox"
                                    className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                    checked={userSelectedHotels.includes(hotel.id)}
                                    onChange={() => handleToggleUserHotel(hotel.id)}
                                  />
                                  <span className="truncate">{hotel.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Editor sadece yukarıda seçilen oteller üzerinde düzenleme yapabilir.
                          </p>
                        </div>
                      )}

                      <div className="pt-1 flex gap-2">
                        {userEditing && (
                          <button
                            type="button"
                            onClick={resetUserForm}
                            className="flex-1 text-xs border border-slate-300 hover:bg-slate-100 rounded-lg py-2 transition-colors font-medium text-slate-700"
                          >
                            Vazgeç
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={userSaving}
                          className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg py-2 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {userSaving ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                          {userEditing ? 'Güncelle' : 'Kaydet'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Right Column: User Permissions List */}
                  <div className="p-5 md:col-span-3 flex flex-col overflow-hidden bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                      Kayıtlı Kullanıcı İzinleri
                    </h4>

                    <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                      {usersLoading ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 gap-2">
                          <Loader2 size={24} className="animate-spin text-indigo-500" />
                          <span className="text-xs">Kullanıcılar yükleniyor...</span>
                        </div>
                      ) : userRolesList.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs font-medium">
                          Veritabanında kayıtlı özel yetkilendirme bulunmuyor.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {/* Hardcoded alper user display for informational purpose */}
                          <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/50">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">alper28072011@gmail.com</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                                  <Shield size={10} className="mr-1" /> superadmin
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500">Sistem Kurucusu & Tam Yetkili</p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Varsayılan</span>
                          </div>

                          {userRolesList.map(u => (
                            <div key={u.email} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <div className="space-y-0.5 min-w-0 pr-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs text-slate-800 truncate">{u.email}</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                    u.role === 'superadmin' 
                                      ? 'bg-indigo-100 text-indigo-800' 
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    <Shield size={10} className="mr-1" /> {u.role}
                                  </span>
                                </div>
                                {u.role === 'editor' && (
                                  <p className="text-[10px] text-slate-500">
                                    Yetkili Otel Sayısı: <span className="font-bold text-slate-700">{u.allowedHotels.length}</span>
                                    {u.allowedHotels.length > 0 && (
                                      <span className="truncate block mt-0.5 text-slate-400">
                                        ({u.allowedHotels.map(id => hotelsList.find(h => h.id === id)?.name || id).join(', ')})
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleEditUserRole(u)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-bold shrink-0"
                              >
                                Düzenle
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 3: MODULAR MODEL SELECTION --- */}
              {isSuperAdmin && activeTab === 'modular' && (
                <div className="h-full overflow-y-auto p-6 space-y-6">
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
                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Veri Koçu</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.coach}
                        onChange={(e) => handleModularModelChange('coach', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Veri koçu asistanının veri yapılandırma tavsiyelerinde kullandığı model.
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm space-y-2">
                      <span className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Simülasyon Sohbeti</span>
                      <select
                        className="w-full form-select rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-sm py-1.5 px-2"
                        value={modularModels.simulator}
                        onChange={(e) => handleModularModelChange('simulator', e.target.value)}
                      >
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        ChatBot simülatörü ve müşteri personası sohbetlerinde kullanılan model.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 4: TOKEN LOGS --- */}
              {activeTab === 'logs' && (
                <div className="h-full overflow-y-auto p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-800">Veritabanı Kayıtlı Token Tüketimi</label>
                    <span className="text-xs font-medium text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/50">
                      Toplam: {tokens.toLocaleString('tr-TR')} tkn
                    </span>
                  </div>
                  
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                    <div className="max-h-[320px] overflow-y-auto">
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

        {/* Footer - Fixed Height */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-3 shrink-0">
          <button 
            disabled={saveLoading}
            onClick={onClose}
            className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-200/60 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            {activeTab === 'users' ? 'Kapat' : 'İptal'}
          </button>
          {activeTab !== 'users' && (
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
          )}
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;

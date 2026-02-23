
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { HotelNode, ArchitectAction, HotelSummary, SuggestedAction } from '../types';
import { 
  getInitialData, generateId, findNodeById, regenerateIds, cleanTreeValues, 
  analyzeHotelStats, filterHotelTree, addChildToNode 
} from '../utils/treeUtils';
import TreeViewNode from './TreeViewNode';
import NodeEditor from './NodeEditor';
import ChatBot from './ChatBot';
import AIArchitectModal from './AIArchitectModal';
import DataHealthModal from './DataHealthModal';
import CreateHotelModal from './CreateHotelModal';
import TemplateModal from './TemplateModal';
import DataCheckModal from './DataCheckModal'; 
import AIPersonaModal from './AIPersonaModal';
import TemplateManager from './TemplateManager';
import ExportModal from './ExportModal'; // NEW
import { fetchHotelById, getHotelsList, createNewHotel } from '../services/firestoreService';
import { useHotel } from '../contexts/HotelContext'; 
import { 
  Download, Upload, Sparkles, Layout, Menu, MessageSquare, X, Loader2, 
  Wifi, WifiOff, CircleCheck, CircleAlert, Building2, CirclePlus, 
  ChevronDown, LayoutTemplate, Activity, Database, Clock, Save, 
  Scale, ChevronUp, Search, Wrench, Brain
} from 'lucide-react';

const Toast = ({ message, type }: { message: string, type: 'success' | 'error' | 'loading' }) => (
  <div className={`
    fixed bottom-14 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border animate-in fade-in slide-in-from-bottom-4 duration-300
    ${type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
    ${type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : ''}
    ${type === 'loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
  `}>
    {type === 'success' && <CircleCheck size={18} />}
    {type === 'error' && <CircleAlert size={18} />}
    {type === 'loading' && <Loader2 size={18} className="animate-spin" />}
    <span className="text-sm font-medium">{message}</span>
  </div>
);

const App: React.FC = () => {
  const { 
    hotelData, 
    setHotelData, 
    hotelId, 
    setHotelId, 
    updateNode, 
    addChild, 
    deleteNode, 
    moveNode,
    saveStatus, 
    hasUnsavedChanges,
    forceSave,
    displayLanguage,
    setDisplayLanguage
  } = useHotel();

  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [hotelsList, setHotelsList] = useState<HotelSummary[]>([]);
  const [isHotelSelectorOpen, setIsHotelSelectorOpen] = useState(false);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  
  // Modals
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDataCheckOpen, setIsDataCheckOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false); // NEW
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'loading'} | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = findNodeById(hotelData, selectedNodeId) || hotelData;
  const stats = useMemo(() => analyzeHotelStats(hotelData), [hotelData]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return hotelData;
    return filterHotelTree(hotelData, searchQuery) || hotelData;
  }, [hotelData, searchQuery]);

  const formatLastSaved = (timestamp?: number) => {
    if (!timestamp) return 'Unsaved Session';
    return new Date(timestamp).toLocaleString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const list = await getHotelsList();
        setHotelsList(list);
        
        if (list.length > 0) {
          const firstHotelId = list[0].id;
          await loadHotelData(firstHotelId);
        }
      } catch (error) {
        console.warn("Cloud connection issue.", error);
      } finally {
        setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  const loadHotelData = async (id: string) => {
    try {
      const data = await fetchHotelById(id);
      if (data) {
        setHotelData(data); 
        setHotelId(id);
        setSelectedNodeId(data.id || 'root');
      }
    } catch (e) {
      console.error(e);
      setNotification({ message: "Veri yüklenemedi.", type: 'error' });
    }
  };

  const handleSwitchHotel = async (id: string) => {
    setIsHotelSelectorOpen(false);
    if (id === hotelId) return;
    setNotification({ message: "Otel değiştiriliyor...", type: 'loading' });
    await loadHotelData(id);
    setNotification(null);
  };

  const handleCreateNewHotel = async (name: string, templateData?: HotelNode, isStructureOnly?: boolean) => {
    setIsHotelSelectorOpen(false);
    setNotification({ message: "Otel oluşturuluyor...", type: 'loading' });

    try {
      let newHotelData: HotelNode;
      const now = Date.now();

      if (templateData) {
        newHotelData = regenerateIds(templateData);
        if (isStructureOnly) newHotelData = cleanTreeValues(newHotelData);
        newHotelData.name = name;
      } else {
        newHotelData = getInitialData();
        newHotelData.name = { tr: name, en: name }; // Init new hotel with localized name
      }
      
      newHotelData.lastSaved = now;

      const newId = await createNewHotel(newHotelData);
      setHotelsList(prev => [...prev, { id: newId, name: name }]);
      
      setHotelId(newId);
      setHotelData(newHotelData);
      setSelectedNodeId('root');

      setNotification({ message: "Otel başarıyla oluşturuldu!", type: 'success' });
    } catch (error) {
      setNotification({ message: "Hata oluştu.", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteNodeWrapper = async (id: string) => {
    if (id === 'root') return;
    if (!window.confirm("Bu öğeyi silmek istediğinize emin misiniz?")) return;
    deleteNode(id); 
    if (selectedNodeId === id) setSelectedNodeId('root');
    setNotification({ message: "Öğe silindi.", type: 'success' });
    setTimeout(() => setNotification(null), 2000);
  };

  // --- ARCHITECT HANDLERS ---
  const handleArchitectActions = (actions: ArchitectAction[]) => {
      let successCount = 0;
      actions.forEach(action => {
          try {
              if (action.type === 'add' && action.data) {
                  setHotelData(prev => {
                      const newNode = { ...action.data, id: action.data?.id || generateId('ai') } as HotelNode;
                      // Ensure localized text
                      if(typeof newNode.name === 'string') newNode.name = { tr: newNode.name, en: '' };
                      return addChildToNode(prev, action.targetId, newNode);
                  });
                  successCount++;
              } else if (action.type === 'update' && action.data) {
                  updateNode(action.targetId, action.data);
                  successCount++;
              } else if (action.type === 'delete') {
                  deleteNode(action.targetId);
                  successCount++;
              }
          } catch(e) { console.error(e); }
      });
      if(successCount > 0) {
          setNotification({ message: "Yapı güncellendi.", type: 'success' });
          setTimeout(() => setNotification(null), 2000);
      }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('nodeId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string, position: 'inside' | 'before' | 'after') => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('nodeId');
    if (sourceId && sourceId !== targetId) {
      moveNode(sourceId, targetId, position);
    }
  };

  const handleImportClick = () => { fileInputRef.current?.click(); setMobileToolsOpen(false); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed._metadata) delete parsed._metadata;
        setHotelData(parsed); 
        setSelectedNodeId(parsed.id || 'root');
        setNotification({ message: "Dosya içe aktarıldı.", type: 'success' });
      } catch (err) { alert("Geçersiz JSON dosyası"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManualSave = async () => {
      setMobileToolsOpen(false);
      setNotification({ message: "Kaydediliyor...", type: 'loading' });
      try {
          await forceSave(); 
          setNotification({ message: "Kaydedildi!", type: 'success' });
      } catch (e) {
          setNotification({ message: "Kayıt hatası.", type: 'error' });
      } finally {
          setTimeout(() => setNotification(null), 2000);
      }
  };

  const handleOpenPersonaModal = useCallback(() => {
    setIsPersonaModalOpen(true);
  }, []);

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <h2 className="text-lg font-semibold text-slate-700">Sistem Yükleniyor...</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-800 font-sans relative">
      {notification && <Toast message={notification.message} type={notification.type} />}

      {exportProgress !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Veri Hazırlanıyor</h3>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2">
                 <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">%{exportProgress} Tamamlandı</div>
           </div>
        </div>
      )}

      <AIArchitectModal isOpen={isArchitectOpen} onClose={() => setIsArchitectOpen(false)} data={hotelData} onApplyActions={handleArchitectActions} />
      
      <DataHealthModal 
        isOpen={isHealthModalOpen} 
        onClose={() => setIsHealthModalOpen(false)} 
        data={hotelData} 
        onApplyFix={updateNode} 
        onLocate={(id) => setSelectedNodeId(id)}
      />
      
      <DataCheckModal isOpen={isDataCheckOpen} onClose={() => setIsDataCheckOpen(false)} data={hotelData} onApplyAction={(action) => {
            if (action.type === 'add') {
                setHotelData(prev => {
                     const newNode = { ...action.data, id: action.data.id || generateId('import') } as HotelNode;
                     // Ensure localization for new nodes
                     if(typeof newNode.name === 'string') newNode.name = { tr: newNode.name, en: '' };
                     const targetId = action.targetId === 'root' ? prev.id : action.targetId;
                     return addChildToNode(prev, targetId, newNode);
                });
            } else if (action.type === 'update') updateNode(action.targetId, action.data);
            setNotification({ message: "Uygulandı.", type: 'success' });
      }} />
      <CreateHotelModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreate={handleCreateNewHotel} />
      <TemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} data={hotelData} />
      <AIPersonaModal isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} />
      <TemplateManager isOpen={isTemplateManagerOpen} onClose={() => setIsTemplateManagerOpen(false)} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} data={hotelData} onExportProgress={setExportProgress} />

      <header className="h-20 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-30 shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-slate-600"><Menu size={20} /></button>
          <div className="flex items-center gap-4">
             <div className="bg-blue-600 p-1.5 rounded-md text-white shadow-sm"><Layout size={18} /></div>
             
             <div className="relative">
                <button onClick={() => setIsHotelSelectorOpen(!isHotelSelectorOpen)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors group">
                   <div className="flex flex-col items-start">
                     <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase leading-none">Aktif Otel</span>
                     <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                       {hotelsList.find(h => h.id === hotelId)?.name || (typeof hotelData.name === 'string' ? hotelData.name : hotelData.name?.en) || "İsimsiz Otel"}
                       <ChevronDown size={12} className="text-slate-400 group-hover:text-blue-500" />
                     </span>
                   </div>
                </button>
                {isHotelSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsHotelSelectorOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in fade-in zoom-in-95">
                       <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Otel Değiştir</div>
                       <div className="max-h-60 overflow-y-auto">
                         {hotelsList.map(hotel => (
                           <button key={hotel.id} onClick={() => handleSwitchHotel(hotel.id)} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${hotelId === hotel.id ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'}`}>
                              <Building2 size={16} className="opacity-50" /> {hotel.name}
                              {hotelId === hotel.id && <CircleCheck size={14} className="ml-auto" />}
                           </button>
                         ))}
                       </div>
                       <div className="border-t border-slate-100 mt-2 pt-2 px-2 space-y-1">
                          <button onClick={() => { setIsHotelSelectorOpen(false); setIsCreateModalOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"><CirclePlus size={16} /> Yeni Otel Ekle</button>
                       </div>
                    </div>
                  </>
                )}
             </div>
             
             {/* LANGUAGE TOGGLE */}
             <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button 
                    onClick={() => setDisplayLanguage('tr')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${displayLanguage === 'tr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    TR
                </button>
                <div className="w-px h-3 bg-slate-300 mx-1"></div>
                <button 
                    onClick={() => setDisplayLanguage('en')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${displayLanguage === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    EN
                </button>
             </div>

             <div className="hidden md:flex items-center gap-3">
                 <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${hotelId ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {hotelId ? <Wifi size={10} /> : <WifiOff size={10} />} {hotelId ? 'Online' : 'Offline'}
                 </div>
                 
                 {hotelId && (
                     <div className="flex items-center gap-2 transition-all duration-300">
                         {saveStatus === 'saving' ? (
                             <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Kaydediliyor...</span>
                         ) : hasUnsavedChanges ? (
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1"><CircleAlert size={10}/> Kaydedilmemiş Değişiklikler</span>
                                <button 
                                  onClick={handleManualSave}
                                  className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded hover:bg-amber-200 transition-colors"
                                >
                                  Şimdi Kaydet
                                </button>
                             </div>
                         ) : (
                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><CircleCheck size={10}/> Güncel</span>
                         )}
                     </div>
                 )}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center">
              <button onClick={() => setIsTemplateManagerOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-100 rounded hover:bg-indigo-200 mr-2"><LayoutTemplate size={14} className="mr-1.5" /> Şablonlar</button>
              <button onClick={() => setIsDataCheckOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-100 rounded hover:bg-cyan-200 mr-2"><Scale size={14} className="mr-1.5" /> Veri Kontrol</button>
              <button onClick={() => setIsHealthModalOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 mr-2"><Activity size={14} className="mr-1.5" /> Sağlık Raporu</button>
              
              {/* REDESIGNED AI ARCHITECT BUTTON - SOLID COLOR FALLBACK */}
              <button 
                onClick={() => setIsArchitectOpen(true)} 
                className="flex items-center gap-2 px-4 py-2 text-[11px] font-black text-white bg-[#7c3aed] hover:bg-[#6d28d9] rounded-lg shadow-md hover:shadow-lg transition-all duration-200 mr-2 border border-white/10 active:scale-95"
                style={{ backgroundColor: '#7c3aed' }}
              >
                <Sparkles size={14} className="animate-pulse" />
                <span className="uppercase tracking-wider">AI Mimar</span>
              </button>
              
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
              
              <button onClick={handleManualSave} className={`p-2 rounded transition-colors ${hasUnsavedChanges ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`} title="Kaydet">
                  <Save size={18} />
              </button>

              <button onClick={handleImportClick} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="İçe Aktar"><Upload size={18} /></button>
              
              {/* NEW EXPORT BUTTON */}
              <button onClick={() => setIsExportModalOpen(true)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="Dışa Aktar"><Download size={18} /></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json"/>
            
            <div className="relative md:hidden">
               <button onClick={() => setMobileToolsOpen(!mobileToolsOpen)} className="p-2 text-slate-600"><Wrench size={20} /></button>
               {mobileToolsOpen && (
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2">
                    <button onClick={() => { setIsTemplateManagerOpen(true); setMobileToolsOpen(false); }} className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-indigo-600 hover:bg-indigo-50 font-medium"><LayoutTemplate size={16} /> Şablonlar</button>
                    <button 
                      onClick={() => { setIsArchitectOpen(true); setMobileToolsOpen(false); }} 
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-white bg-[#7c3aed] hover:bg-[#6d28d9] font-bold"
                      style={{ backgroundColor: '#7c3aed' }}
                    >
                      <Sparkles size={16} /> AI Mimar
                    </button>
                    <button onClick={handleManualSave} className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-blue-600 hover:bg-blue-50 font-medium"><Save size={16} /> Kaydet</button>
                 </div>
               )}
            </div>
            <button onClick={() => setMobileChatOpen(!mobileChatOpen)} className={`lg:hidden p-2 ml-1 rounded-full ${mobileChatOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}>{mobileChatOpen ? <X size={20} /> : <MessageSquare size={20} />}</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
        <div className={`absolute inset-0 z-20 bg-slate-50 border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-2 lg:block lg:h-full lg:min-h-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-full flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-white sticky top-0 z-10">
                   <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ara..." className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>}
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 min-h-0 pb-20 lg:min-h-0">
                    <TreeViewNode 
                        node={filteredData} 
                        selectedId={selectedNodeId}
                        onSelect={(id) => { setSelectedNodeId(id); setMobileMenuOpen(false); }}
                        onAddChild={(parentId) => addChild(parentId)} 
                        forceExpand={!!searchQuery}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    />
                </div>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-7 bg-white h-full relative z-0 overflow-hidden min-h-0">
             <NodeEditor 
                node={selectedNode} 
                root={hotelData}
                onUpdate={updateNode} 
                onDelete={handleDeleteNodeWrapper}
                onIdChanged={(newId) => setSelectedNodeId(newId)}
             />
        </div>

        <div className={`absolute inset-0 z-20 bg-white transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-3 lg:block lg:h-full lg:min-h-0 ${mobileChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
             <ChatBot 
                key={hotelId || 'default'} 
                data={hotelData} 
                onOpenPersonaModal={handleOpenPersonaModal}
             />
        </div>
      </div>

      <footer className="bg-slate-50 border-t border-slate-200 text-xs text-slate-600 relative z-30 shrink-0">
        <div className="lg:hidden h-10 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-100 border-b border-slate-100" onClick={() => setMobileStatsOpen(!mobileStatsOpen)}>
          <div className="flex items-center gap-2"><Activity size={14} /><span className="font-semibold">Doluluk: %{stats.completionRate}</span></div>
          <ChevronUp size={14} className={`transition-transform duration-300 ${mobileStatsOpen ? 'rotate-180' : ''}`} />
        </div>
        <div className={`lg:h-10 lg:flex lg:items-center lg:justify-between lg:px-4 ${mobileStatsOpen ? 'block p-4 border-b space-y-3' : 'hidden'}`}>
          <div className="flex items-center gap-4 lg:gap-6">
             <div className="flex items-center gap-1.5"><Database size={14} className="text-slate-400" /><span>{stats.totalNodes} Öğe</span></div>
             <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-slate-300 ml-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-slate-500">Son Kayıt:</span>
                <span className="font-mono font-bold text-slate-800">{formatLastSaved(hotelData.lastSaved)}</span>
             </div>
          </div>

          <div className="flex items-center gap-6 flex-1 lg:justify-end pr-4">
             {/* DATA COMPLETION BAR */}
             <div className="w-full max-w-[140px] flex flex-col gap-1">
                <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500"><span>Veri Doluluğu</span><span>%{stats.completionRate}</span></div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full transition-all duration-500 ${stats.completionRate >= 80 ? 'bg-blue-500' : stats.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${stats.completionRate}%` }} />
                </div>
             </div>

             {/* AI READABILITY BAR (NEW) */}
             <div className="w-full max-w-[140px] flex flex-col gap-1">
                <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500">
                    <span className="flex items-center gap-1"><Brain size={10} className="text-primary-500" /> AI Okunabilirlik</span>
                    <span>%{stats.aiReadabilityScore}</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden" title="Yapay zeka için verilerin ne kadar anlaşılır olduğu">
                   <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            stats.aiReadabilityScore >= 80 ? 'bg-emerald-500' : 
                            stats.aiReadabilityScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${stats.aiReadabilityScore}%` }} 
                   />
                </div>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

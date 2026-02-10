
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HotelNode, AIResponse, ArchitectAction, HotelSummary, SuggestedAction } from './types';
import { getInitialData, generateId, findNodeById, regenerateIds, cleanTreeValues, analyzeHotelStats, filterHotelTree, generateOptimizedCSV, generateCleanAIJSON, generateAIText, addChildToNode, updateNodeInTree, deleteNodeFromTree } from './utils/treeUtils';
import TreeViewNode from './components/TreeViewNode';
import NodeEditor from './components/NodeEditor';
import ChatBot from './components/ChatBot';
import AIArchitectModal from './components/AIArchitectModal';
import DataHealthModal from './components/DataHealthModal';
import CreateHotelModal from './components/CreateHotelModal';
import TemplateModal from './components/TemplateModal';
import DataCheckModal from './components/DataCheckModal'; 
import { fetchHotelById, getHotelsList, createNewHotel, updateHotelData } from './services/firestoreService';
import { useHotel } from './contexts/HotelContext';
import { 
  Download, 
  Upload, 
  Sparkles, 
  Layout, 
  Menu,
  MessageSquare,
  X,
  CloudUpload,
  CloudDownload,
  Loader2,
  Wifi,
  WifiOff,
  Bot,
  CheckCircle,
  AlertCircle,
  Trash2,
  Building2,
  PlusCircle,
  ChevronDown,
  LayoutTemplate,
  Activity,
  Database,
  PieChart,
  ChevronUp,
  AlertTriangle,
  Search,
  MoreVertical,
  Wrench,
  Scale,
  Clock,
  Save,
  FileJson,
  FileSpreadsheet,
  FileText,
  Braces
} from 'lucide-react';

// Simple Toast Notification Component
const Toast = ({ message, type }: { message: string, type: 'success' | 'error' | 'loading' }) => (
  <div className={`
    fixed bottom-14 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border animate-in fade-in slide-in-from-bottom-4 duration-300
    ${type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
    ${type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : ''}
    ${type === 'loading' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
  `}>
    {type === 'success' && <CheckCircle size={18} />}
    {type === 'error' && <AlertCircle size={18} />}
    {type === 'loading' && <Loader2 size={18} className="animate-spin" />}
    <span className="text-sm font-medium">{message}</span>
  </div>
);

const App: React.FC = () => {
  // --- USE HOTEL CONTEXT (GLOBAL STATE) ---
  const { 
    hotelData, 
    setHotelData, 
    hotelId, 
    setHotelId, 
    updateNode, 
    addChild, 
    deleteNode, 
    saveStatus, 
    forceSave 
  } = useHotel();

  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  
  // Multi-Hotel State (List management stays in App for now)
  const [hotelsList, setHotelsList] = useState<HotelSummary[]>([]);
  const [isHotelSelectorOpen, setIsHotelSelectorOpen] = useState(false);
  
  // UI State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDataCheckOpen, setIsDataCheckOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Export Progress State
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'loading'} | null>(null);

  // Cloud States
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state: The node currently being edited
  const selectedNode = findNodeById(hotelData, selectedNodeId) || hotelData;

  // Derived state: Statistics
  const stats = useMemo(() => analyzeHotelStats(hotelData), [hotelData]);

  // Derived state: Filtered Tree for Search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return hotelData;
    return filterHotelTree(hotelData, searchQuery) || hotelData;
  }, [hotelData, searchQuery]);

  // Helper to format timestamps
  const formatLastSaved = (timestamp?: number) => {
    if (!timestamp) return 'Unsaved Session';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // --- Initialization & Hotel List Loading ---
  useEffect(() => {
    const initApp = async () => {
      try {
        const list = await getHotelsList();
        setHotelsList(list);
        
        if (list.length > 0) {
          const firstHotelId = list[0].id;
          await loadHotelData(firstHotelId);
        } else {
          console.log("No hotels found in cloud. Starting with default template.");
        }
      } catch (error) {
        console.warn("Could not connect to cloud on startup.", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();
  }, []);

  // Helper to load specific hotel data
  const loadHotelData = async (id: string) => {
    setIsLoadingCloud(true);
    try {
      const data = await fetchHotelById(id);
      if (data) {
        setHotelData(data);
        setHotelId(id);
        setSelectedNodeId(data.id || 'root');
      }
    } catch (e) {
      console.error("Failed to load hotel data", e);
      setNotification({ message: "Failed to load hotel data.", type: 'error' });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // --- Hotel Switching Logic ---
  const handleSwitchHotel = async (id: string) => {
    setIsHotelSelectorOpen(false);
    if (id === hotelId) return;

    setNotification({ message: "Switching hotel...", type: 'loading' });
    await loadHotelData(id);
    setNotification(null);
  };

  const handleCreateNewHotel = async (name: string, templateData?: HotelNode, isStructureOnly?: boolean) => {
    setIsHotelSelectorOpen(false);
    setNotification({ message: "Creating new hotel...", type: 'loading' });

    try {
      let newHotelData: HotelNode;
      const now = Date.now();

      if (templateData) {
        console.log("Importing from Template...");
        newHotelData = regenerateIds(templateData);
        if (isStructureOnly) {
           newHotelData = cleanTreeValues(newHotelData);
        }
        newHotelData.name = name;
        if (newHotelData.children && newHotelData.children[0]?.children?.[0]?.type === 'field') {
            newHotelData.children[0].children[0].value = name;
        }
      } else {
        newHotelData = getInitialData();
        newHotelData.name = name;
        if (newHotelData.children && newHotelData.children[0]?.children?.[0]?.type === 'field') {
           newHotelData.children[0].children[0].value = name;
        }
      }
      
      newHotelData.lastSaved = now;

      // Firestore Call
      const newId = await createNewHotel(newHotelData);
      
      const newSummary = { id: newId, name: name };
      setHotelsList(prev => [...prev, newSummary]);
      
      // Update Context
      setHotelId(newId);
      setHotelData(newHotelData);
      setSelectedNodeId('root');

      setNotification({ message: "Hotel created successfully!", type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: "Failed to create hotel.", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // --- Wrapper Handlers for UI ---
  // We use Context actions, but keep these for UI side effects (notifications, confirmations)

  const handleDeleteNodeWrapper = async (id: string) => {
    if (id === 'root') {
      setNotification({ message: "Root node cannot be deleted.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      return;
    }

    deleteNode(id);
    if (selectedNodeId === id) {
      setSelectedNodeId('root');
    }
    setNotification({ message: "Item deleted.", type: 'success' });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleArchitectActions = (actions: ArchitectAction[]) => {
    // Process actions sequentially using context
    actions.forEach(action => {
       try {
         if (action.type === 'add' && action.data) {
            // Since addChild in context generates ID, we need to adapt if architect provides specific data
            // For now, simpler to just add blank and update, but let's manual insert via updateNode workaround if complex
            // A better way for Context is to expose a raw `dispatch` or generic `updateTree` method.
            // For now, we simulate by adding then updating if needed, OR we can just update the whole tree if complex.
            // Optimization: Let's use `updateNode` on parent? No.
            // Fallback: We can implement specific Architect support in context later.
            // For this version, let's use the primitive context methods:
            
            // Note: The context's `addChild` is simple. For AI Actions with full data, 
            // we might need to manually invoke a tree utility and setHotelData.
            // BUT, to keep it clean, let's just do:
            // This is a limitation of the simplified `addChild` context method.
            // Let's rely on the fact that `setHotelData` is available.
            
            // We will fetch current, modify, and set. This breaks strict action pattern but works for complex bulk updates.
            setHotelData(prev => {
                // Use imported utils directly here for bulk atomic update
                if (action.type === 'add') {
                     // Need to inject the specific data, not just blank
                     // We need a utility that allows adding specific node
                     // Let's assume we can use `addChildToNode` from utils
                     // This is safe because `setHotelData` updates the context state.
                     const newNode = { ...action.data, id: action.data?.id || generateId('ai') } as HotelNode;
                     return addChildToNode(prev, action.targetId, newNode);
                } 
                return prev;
            });

         } else if (action.type === 'update' && action.data) {
            updateNode(action.targetId, action.data);
         } else if (action.type === 'delete') {
            deleteNode(action.targetId);
         }
       } catch (e) {
         console.error(e);
       }
    });
  };

  // --- File Operations ---

  const handleExport = async (format: 'json' | 'clean-json' | 'csv' | 'txt') => {
    setIsExportMenuOpen(false);
    setMobileToolsOpen(false);

    const now = new Date();
    const timestampStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0].slice(0, 16);
    const safeName = (hotelData.name || "hotel_data").replace(/\s+/g, '_');
    
    let dataStr = '';
    let fileName = '';
    
    setIsExporting(true);
    setExportProgress(10);

    try {
      await new Promise(r => setTimeout(r, 100));

      if (format === 'json') {
          const exportData = {
            ...hotelData,
            _metadata: { exportedAt: now.toISOString(), system: "Hotel Data CMS" }
          };
          dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          fileName = `${safeName}_BACKUP_${timestampStr}.json`;
          setExportProgress(100);
      } else if (format === 'clean-json') {
          setExportProgress(30);
          const cleanData = generateCleanAIJSON(hotelData);
          setExportProgress(90);
          dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
          fileName = `${safeName}_AI-CLEAN_${timestampStr}.json`;
          setExportProgress(100);
      } else if (format === 'txt') {
          setExportProgress(20);
          const textContent = await generateAIText(hotelData, (p) => setExportProgress(p));
          dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(textContent);
          fileName = `${safeName}_AI-CONTEXT_${timestampStr}.txt`;
      } else {
          const csvContent = await generateOptimizedCSV(hotelData, (percent) => setExportProgress(percent));
          dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
          fileName = `${safeName}_AI-TABLE_${timestampStr}.csv`;
      }

      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      setNotification({ message: `Exported successfully!`, type: 'success' });
    } catch (e) {
      console.error(e);
      setNotification({ message: `Failed to export.`, type: 'error' });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setMobileToolsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed._metadata) delete parsed._metadata;

        setHotelData(parsed);
        setSelectedNodeId(parsed.id || 'root');
        setNotification({ message: "File imported successfully.", type: 'success' });
      } catch (err) {
        alert("Invalid JSON file");
      } finally {
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Manual Save Handler ---
  const handleManualSave = async () => {
      setMobileToolsOpen(false);
      setNotification({ message: "Saving...", type: 'loading' });
      try {
          await forceSave();
          setNotification({ message: "Saved successfully!", type: 'success' });
      } catch (e) {
          setNotification({ message: "Save failed.", type: 'error' });
      } finally {
          setTimeout(() => setNotification(null), 2000);
      }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <h2 className="text-lg font-semibold text-slate-700">Loading Hotel System...</h2>
        <p className="text-sm opacity-75 mt-2">Connecting to multi-hotel database.</p>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-800 font-sans relative">
      
      {notification && <Toast message={notification.message} type={notification.type} />}

      {/* MODALS */}
      {isExporting && exportProgress !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Data</h3>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2">
                 <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{exportProgress}% Complete</div>
           </div>
        </div>
      )}

      <AIArchitectModal 
        isOpen={isArchitectOpen} 
        onClose={() => setIsArchitectOpen(false)}
        data={hotelData}
        onApplyActions={handleArchitectActions}
      />

      <DataHealthModal 
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        data={hotelData}
        onApplyFix={updateNode}
      />

      <DataCheckModal 
        isOpen={isDataCheckOpen}
        onClose={() => setIsDataCheckOpen(false)}
        data={hotelData}
        onApplyAction={(action) => {
            if (action.type === 'add') {
                // Using simple Context actions via raw logic
                setHotelData(prev => {
                     const newNode = { ...action.data, id: action.data.id || generateId('import') } as HotelNode;
                     const targetId = action.targetId === 'root' ? prev.id : action.targetId;
                     return addChildToNode(prev, targetId, newNode);
                });
            } else if (action.type === 'update') {
                updateNode(action.targetId, action.data);
            }
            setNotification({ message: "Action applied.", type: 'success' });
            setTimeout(() => setNotification(null), 2000);
        }}
      />
      
      <CreateHotelModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNewHotel}
      />

      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        data={hotelData}
      />

      {/* HEADER */}
      <header className="h-20 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-30 shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-slate-600">
             <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
             <div className="bg-blue-600 p-1.5 rounded-md text-white shadow-sm">
                <Layout size={18} />
             </div>

             {/* HOTEL SELECTOR */}
             <div className="relative">
                <button 
                  onClick={() => setIsHotelSelectorOpen(!isHotelSelectorOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors group"
                >
                   <div className="flex flex-col items-start">
                     <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase leading-none">Current Hotel</span>
                     <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                       {hotelsList.find(h => h.id === hotelId)?.name || hotelData.name || "My Hotel"}
                       <ChevronDown size={12} className="text-slate-400 group-hover:text-blue-500" />
                     </span>
                   </div>
                </button>

                {isHotelSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsHotelSelectorOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                       <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Switch Hotel</div>
                       <div className="max-h-60 overflow-y-auto">
                         {hotelsList.map(hotel => (
                           <button
                             key={hotel.id}
                             onClick={() => handleSwitchHotel(hotel.id)}
                             className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${hotelId === hotel.id ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'}`}
                           >
                              <Building2 size={16} className="opacity-50" />
                              {hotel.name}
                              {hotelId === hotel.id && <CheckCircle size={14} className="ml-auto" />}
                           </button>
                         ))}
                       </div>
                       <div className="border-t border-slate-100 mt-2 pt-2 px-2 space-y-1">
                          <button 
                            onClick={() => { setIsHotelSelectorOpen(false); setIsCreateModalOpen(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                          >
                             <PlusCircle size={16} /> Create New Hotel
                          </button>
                          <button 
                             onClick={() => { setIsHotelSelectorOpen(false); setIsTemplateModalOpen(true); }}
                             className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pink-600 hover:bg-pink-50 rounded-lg font-medium"
                          >
                             <LayoutTemplate size={16} /> Save as Template
                          </button>
                       </div>
                    </div>
                  </>
                )}
             </div>
             
             {/* Connection & AutoSave Status */}
             <div className="hidden md:flex items-center gap-3">
                 <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                   hotelId 
                     ? 'bg-green-50 text-green-700 border-green-200' 
                     : 'bg-slate-100 text-slate-500 border-slate-200'
                 }`}>
                    {hotelId ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {hotelId ? 'Online' : 'Offline'}
                 </div>

                 {/* AUTO-SAVE INDICATOR */}
                 {hotelId && (
                     <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-300">
                         {saveStatus === 'saving' && <span className="text-blue-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Saving...</span>}
                         {saveStatus === 'saved' && <span className="text-slate-400 flex items-center gap-1"><CheckCircle size={10}/> All changes saved</span>}
                         {saveStatus === 'error' && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={10}/> Save Error</span>}
                     </div>
                 )}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
            {/* DESKTOP ACTIONS */}
            <div className="hidden md:flex items-center">
              <button onClick={() => setIsDataCheckOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-100 rounded hover:bg-cyan-200 mr-2">
                  <Scale size={14} className="mr-1.5" /> Data Check
              </button>
              <button onClick={() => setIsHealthModalOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 mr-2">
                  <Activity size={14} className="mr-1.5" /> Health Check
              </button>
              <button onClick={() => setIsArchitectOpen(true)} className="flex items-center px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded hover:shadow-md mr-2">
                  <Sparkles size={14} className="mr-1.5" /> AI Architect
              </button>
              
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
              
              <button onClick={handleManualSave} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Force Save">
                  <Save size={18} />
              </button>

              <button onClick={handleImportClick} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="Import JSON">
                  <Upload size={18} />
              </button>
              
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="Export">
                  <Download size={18} />
              </button>
              
              {/* Export Menu */}
              {isExportMenuOpen && (
                 <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}/>
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">Standard</div>
                        <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"><FileJson size={14} className="text-amber-500" /> Backup JSON</button>
                        <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"><FileSpreadsheet size={14} className="text-emerald-500" /> Excel / CSV</button>
                        <div className="px-3 py-2 mt-1 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50 border-t border-slate-100">AI Optimized</div>
                        <button onClick={() => handleExport('clean-json')} className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"><Braces size={14} className="text-indigo-500" /> Clean JSON</button>
                        <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"><FileText size={14} className="text-violet-500" /> Structured Text</button>
                    </div>
                 </>
              )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json"/>

            {/* MOBILE ACTIONS */}
            <div className="relative md:hidden">
               <button onClick={() => setMobileToolsOpen(!mobileToolsOpen)} className="p-2 text-slate-600"><Wrench size={20} /></button>
               {mobileToolsOpen && (
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2">
                    <button onClick={() => { setIsArchitectOpen(true); setMobileToolsOpen(false); }} className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-violet-600 hover:bg-violet-50 font-medium"><Sparkles size={16} /> AI Architect</button>
                    <button onClick={handleManualSave} className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-blue-600 hover:bg-blue-50 font-medium"><Save size={16} /> Save</button>
                    {/* Add other mobile items as needed */}
                 </div>
               )}
            </div>
            
            <button onClick={() => setMobileChatOpen(!mobileChatOpen)} className={`lg:hidden p-2 ml-1 rounded-full ${mobileChatOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}>
                {mobileChatOpen ? <X size={20} /> : <MessageSquare size={20} />}
            </button>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
        {/* Navigation Sidebar */}
        <div className={`absolute inset-0 z-20 bg-slate-50 border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-2 lg:block lg:h-full lg:min-h-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-full flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-white sticky top-0 z-10">
                   <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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
                    />
                </div>
            </div>
        </div>

        {/* Editor Area */}
        <div className="col-span-12 lg:col-span-7 bg-white h-full relative z-0 overflow-hidden min-h-0">
             <NodeEditor 
                node={selectedNode} 
                root={hotelData}
                onUpdate={updateNode} 
                onDelete={handleDeleteNodeWrapper}
             />
        </div>

        {/* Chatbot Sidebar */}
        <div className={`absolute inset-0 z-20 bg-white transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-3 lg:block lg:h-full lg:min-h-0 ${mobileChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
             <ChatBot key={hotelId || 'default'} data={hotelData} />
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-50 border-t border-slate-200 text-xs text-slate-600 relative z-30 shrink-0">
        <div className="lg:hidden h-10 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-100 border-b border-slate-100" onClick={() => setMobileStatsOpen(!mobileStatsOpen)}>
          <div className="flex items-center gap-2"><Activity size={14} /><span className="font-semibold">Health: {stats.completionRate}%</span></div>
          <ChevronUp size={14} className={`transition-transform duration-300 ${mobileStatsOpen ? 'rotate-180' : ''}`} />
        </div>
        <div className={`lg:h-10 lg:flex lg:items-center lg:justify-between lg:px-4 ${mobileStatsOpen ? 'block p-4 border-b space-y-3' : 'hidden'}`}>
          <div className="flex items-center gap-4 lg:gap-6">
             <div className="flex items-center gap-1.5"><Database size={14} className="text-slate-400" /><span>{stats.totalNodes} Nodes</span></div>
             <div className="hidden lg:flex items-center gap-1.5"><Menu size={14} className="text-slate-400" /><span>Depth: {stats.depth}</span></div>
             <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-slate-300 ml-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-slate-500">Last Saved:</span>
                <span className="font-mono font-bold text-slate-800">{formatLastSaved(hotelData.lastSaved)}</span>
             </div>
          </div>
          <div className="flex items-center gap-4 flex-1 lg:justify-center">
             <div className="w-full max-w-xs flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500"><span>Completeness</span><span>{stats.completionRate}%</span></div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full transition-all duration-500 ${stats.completionRate >= 80 ? 'bg-emerald-500' : stats.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${stats.completionRate}%` }} />
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6 lg:justify-end">
             <div className="flex items-center gap-1.5 text-amber-600"><AlertTriangle size={14} /><span className="font-mono font-medium">{stats.emptyItems}</span> Empty</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

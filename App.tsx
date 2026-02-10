
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HotelNode, AIResponse, ArchitectAction, HotelSummary, SuggestedAction } from './types';
import { getInitialData, updateNodeInTree, addChildToNode, deleteNodeFromTree, generateId, findNodeById, regenerateIds, cleanTreeValues, analyzeHotelStats, filterHotelTree, generateOptimizedCSV, generateCleanAIJSON, generateAIText } from './utils/treeUtils';
import TreeViewNode from './components/TreeViewNode';
import NodeEditor from './components/NodeEditor';
import ChatBot from './components/ChatBot';
import AIArchitectModal from './components/AIArchitectModal';
import DataHealthModal from './components/DataHealthModal';
import CreateHotelModal from './components/CreateHotelModal';
import TemplateModal from './components/TemplateModal';
import DataCheckModal from './components/DataCheckModal'; 
import { updateHotelData, fetchHotelById, getHotelsList, createNewHotel } from './services/firestoreService';
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
  // Application Data State
  const [data, setData] = useState<HotelNode>(getInitialData());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  
  // Multi-Hotel State
  const [hotelsList, setHotelsList] = useState<HotelSummary[]>([]);
  const [currentHotelId, setCurrentHotelId] = useState<string | null>(null);
  const [isHotelSelectorOpen, setIsHotelSelectorOpen] = useState(false);
  
  // UI State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false); // Toggle for footer stats on mobile
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false); // New state for mobile tools menu
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDataCheckOpen, setIsDataCheckOpen] = useState(false); // New Data Check State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false); // State for export dropdown
  const [searchQuery, setSearchQuery] = useState('');
  
  // Export Progress State
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'loading'} | null>(null);

  // Cloud States
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('offline');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state: The node currently being edited
  const selectedNode = findNodeById(data, selectedNodeId) || data;

  // Derived state: Statistics (Memoized to prevent recalculation on every render)
  const stats = useMemo(() => analyzeHotelStats(data), [data]);

  // Derived state: Filtered Tree for Search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    return filterHotelTree(data, searchQuery) || data; // Return original if null (though filter handles logic)
  }, [data, searchQuery]);

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
        // 1. Fetch list of hotels
        const list = await getHotelsList();
        setHotelsList(list);
        
        if (list.length > 0) {
          // 2. If hotels exist, load the first one
          const firstHotelId = list[0].id;
          setCurrentHotelId(firstHotelId);
          await loadHotelData(firstHotelId);
        } else {
          // 3. If no hotels, we are in "Local/New" mode implicitly
          console.log("No hotels found in cloud. Starting with default template.");
          setConnectionStatus('offline');
        }
      } catch (error) {
        console.warn("Could not connect to cloud on startup.", error);
        setConnectionStatus('offline');
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
      const hotelData = await fetchHotelById(id);
      if (hotelData) {
        setData(hotelData);
        setSelectedNodeId(hotelData.id || 'root');
        setConnectionStatus('connected');
      }
    } catch (e) {
      console.error("Failed to load hotel data", e);
      setNotification({ message: "Failed to load hotel data.", type: 'error' });
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // --- Hotel Switching Logic ---
  
  const handleSwitchHotel = async (hotelId: string) => {
    setIsHotelSelectorOpen(false);
    if (hotelId === currentHotelId) return;

    setNotification({ message: "Switching hotel...", type: 'loading' });
    setCurrentHotelId(hotelId);
    await loadHotelData(hotelId);
    setNotification(null);
  };

  const handleCreateNewHotel = async (name: string, templateData?: HotelNode, isStructureOnly?: boolean) => {
    setIsHotelSelectorOpen(false);
    setNotification({ message: "Creating new hotel...", type: 'loading' });

    try {
      let newHotelData: HotelNode;
      const now = Date.now();

      if (templateData) {
        // ALGORITHM: TEMPLATE IMPORT
        console.log("Importing from Template...");
        // 1. Regenerate IDs to avoid conflicts with other hotels derived from same template
        newHotelData = regenerateIds(templateData);
        
        // 2. If Structure Only, clean the values
        if (isStructureOnly) {
           newHotelData = cleanTreeValues(newHotelData);
        }
        
        // 3. Set the new name
        newHotelData.name = name;
        // Try to update root child name if it exists (usually "General Info" > "Hotel Name")
        // This is heuristic, depends on structure, but safe to try
        if (newHotelData.children && newHotelData.children[0] && newHotelData.children[0].children) {
            // Only update if it looks like a field
            if(newHotelData.children[0].children[0].type === 'field') {
               newHotelData.children[0].children[0].value = name;
            }
        }

      } else {
        // ALGORITHM: FRESH START
        newHotelData = getInitialData();
        newHotelData.name = name;
        if (newHotelData.children && newHotelData.children[0] && newHotelData.children[0].children) {
           newHotelData.children[0].children[0].value = name;
        }
      }
      
      // Initial Save Timestamp
      newHotelData.lastSaved = now;

      const newId = await createNewHotel(newHotelData);
      
      // Update local list
      const newSummary = { id: newId, name: name };
      setHotelsList(prev => [...prev, newSummary]);
      
      // Switch to it
      setCurrentHotelId(newId);
      setData(newHotelData);
      setSelectedNodeId('root'); // Or new root ID
      setConnectionStatus('connected');

      setNotification({ message: "Hotel created successfully!", type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: "Failed to create hotel.", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // --- CRUD Handlers ---

  const handleUpdateNode = useCallback((id: string, updates: Partial<HotelNode>) => {
    setData(prev => updateNodeInTree(prev, id, updates));
  }, []);

  const handleAddChild = useCallback((parentId: string) => {
    const newChild: HotelNode = {
      id: generateId(),
      type: 'item',
      name: 'New Item',
      value: ''
    };
    setData(prev => addChildToNode(prev, parentId, newChild));
  }, []);

  const handleDeleteNode = useCallback(async (id: string) => {
    if (id === 'root') {
      setNotification({ message: "Root node cannot be deleted.", type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      return;
    }

    setNotification({ message: "Deleting item...", type: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      setData(prev => deleteNodeFromTree(prev, id));
      if (selectedNodeId === id) {
        setSelectedNodeId('root');
      }
      setNotification({ message: "Item successfully deleted.", type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: "An error occurred while deleting.", type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  }, [selectedNodeId]);

  // --- AI Architect Handler ---
  
  const handleArchitectActions = useCallback((actions: ArchitectAction[]) => {
    setData(prevData => {
      let newData = { ...prevData };
      actions.forEach(action => {
        try {
          if (action.type === 'add' && action.data) {
             const newNode = { ...action.data, id: action.data.id || generateId('ai') } as HotelNode;
             newData = addChildToNode(newData, action.targetId, newNode);
          } else if (action.type === 'update' && action.data) {
             newData = updateNodeInTree(newData, action.targetId, action.data);
          } else if (action.type === 'delete') {
             newData = deleteNodeFromTree(newData, action.targetId);
             if (selectedNodeId === action.targetId) setSelectedNodeId('root');
          }
        } catch (e) {
          console.error(`Failed to apply action ${action.type}:`, e);
        }
      });
      return newData;
    });
  }, [selectedNodeId]);

  // --- Data Check Action Handler ---
  const handleDataCheckAction = useCallback((action: SuggestedAction) => {
      setData(prevData => {
          let newData = { ...prevData };
          try {
              if (action.type === 'add' && action.targetId) {
                  // Fallback: If targetId is 'root' or missing, use root id
                  const parentId = action.targetId === 'root' ? newData.id : action.targetId;
                  
                  // Ensure ID exists on new data
                  const newNode = { 
                      ...action.data, 
                      id: action.data.id || generateId('import'),
                      type: action.data.type || 'item'
                  } as HotelNode;

                  newData = addChildToNode(newData, parentId, newNode);
                  setNotification({ message: "Item imported successfully.", type: 'success' });
              } 
              else if (action.type === 'update' && action.targetId) {
                  newData = updateNodeInTree(newData, action.targetId, action.data);
                  setNotification({ message: "Item updated successfully.", type: 'success' });
              }
          } catch (e) {
              console.error("Failed to apply data check action", e);
              setNotification({ message: "Failed to apply action.", type: 'error' });
          }
          return newData;
      });
      setTimeout(() => setNotification(null), 3000);
  }, []);

  // --- File Operations ---

  const handleExport = async (format: 'json' | 'clean-json' | 'csv' | 'txt') => {
    // Close menus immediately
    setIsExportMenuOpen(false);
    setMobileToolsOpen(false);

    const now = new Date();
    // Format: YYYY-MM-DD_HH-mm
    const timestampStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0].slice(0, 16);
    const safeName = (data.name || "hotel_data").replace(/\s+/g, '_');
    
    let dataStr = '';
    let fileName = '';
    let mimeType = '';

    // START EXPORT PROCESS
    setIsExporting(true);
    setExportProgress(10); // Start progress

    try {
      await new Promise(r => setTimeout(r, 100)); // UI flush

      if (format === 'json') {
          // Standard Backup JSON
          const exportData = {
            ...data,
            _metadata: {
              exportedAt: now.toISOString(),
              system: "Hotel Data CMS",
              type: "backup"
            }
          };
          dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
          fileName = `${safeName}_BACKUP_${timestampStr}.json`;
          mimeType = 'application/json';
          setExportProgress(100);

      } else if (format === 'clean-json') {
          // AI Optimized JSON (No IDs)
          setExportProgress(30);
          const cleanData = generateCleanAIJSON(data);
          setExportProgress(90);
          
          dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
          fileName = `${safeName}_AI-CLEAN_${timestampStr}.json`;
          mimeType = 'application/json';
          setExportProgress(100);

      } else if (format === 'txt') {
          // AI Optimized Text (Markdown)
          setExportProgress(20);
          const textContent = await generateAIText(data, (p) => setExportProgress(p));
          
          dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(textContent);
          fileName = `${safeName}_AI-CONTEXT_${timestampStr}.txt`;
          mimeType = 'text/plain';

      } else {
          // CSV Export
          const csvContent = await generateOptimizedCSV(data, (percent) => {
              setExportProgress(percent);
          });
          dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
          fileName = `${safeName}_AI-TABLE_${timestampStr}.csv`;
          mimeType = 'text/csv';
      }

      // Brief pause to show completion
      await new Promise(r => setTimeout(r, 300));

      // Download
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
    setMobileToolsOpen(false); // Close mobile menu if open
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        if (parsed._metadata) {
           delete parsed._metadata;
        }

        setData(parsed);
        setSelectedNodeId(parsed.id || 'root');
        setNotification({ message: "File imported successfully.", type: 'success' });
      } catch (err) {
        alert("Invalid JSON file");
        setNotification({ message: "Failed to import file.", type: 'error' });
      } finally {
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Cloud Operations ---

  const handleSaveToCloud = async () => {
    if (!currentHotelId) {
      alert("Please create a hotel first.");
      return;
    }

    setMobileToolsOpen(false);
    setIsSaving(true);
    setNotification({ message: "Syncing with cloud...", type: 'loading' });
    try {
      const now = Date.now();
      const dataToSave = { ...data, lastSaved: now };

      await updateHotelData(currentHotelId, dataToSave);
      
      setHotelsList(prev => prev.map(h => 
        h.id === currentHotelId ? { ...h, name: data.name || h.name } : h
      ));
      
      setData(dataToSave);
      setConnectionStatus('connected');
      setNotification({ message: "Saved to cloud successfully!", type: 'success' });
    } catch (error) {
      console.error(error);
      setConnectionStatus('offline');
      setNotification({ message: "Failed to save to cloud.", type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setNotification(null), 3000);
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-slate-800 font-sans relative">
      
      {notification && <Toast message={notification.message} type={notification.type} />}

      {/* EXPORT PROGRESS OVERLAY */}
      {isExporting && exportProgress !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
              <div className="flex justify-center mb-4">
                 <div className="relative">
                    <FileSpreadsheet size={48} className="text-emerald-500 animate-pulse" />
                    <Sparkles size={20} className="text-amber-400 absolute -top-2 -right-2 animate-bounce" />
                 </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Generating AI-Ready Data</h3>
              <p className="text-sm text-slate-500 mb-6">Structuring data for semantic analysis...</p>
              
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2">
                 <div 
                   className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-300 ease-out"
                   style={{ width: `${exportProgress}%` }}
                 />
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{exportProgress}% Complete</div>
           </div>
        </div>
      )}

      <AIArchitectModal 
        isOpen={isArchitectOpen} 
        onClose={() => setIsArchitectOpen(false)}
        data={data}
        onApplyActions={handleArchitectActions}
      />

      <DataHealthModal 
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        data={data}
        onApplyFix={handleUpdateNode}
      />

      <DataCheckModal 
        isOpen={isDataCheckOpen}
        onClose={() => setIsDataCheckOpen(false)}
        data={data}
        onApplyAction={handleDataCheckAction}
      />
      
      <CreateHotelModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNewHotel}
      />

      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        data={data}
      />

      {/* HEADER */}
      <header className="h-20 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-30 shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-slate-600">
             <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
             {/* Logo Icon */}
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
                       {hotelsList.find(h => h.id === currentHotelId)?.name || data.name || "My Hotel"}
                       <ChevronDown size={12} className="text-slate-400 group-hover:text-blue-500" />
                     </span>
                   </div>
                </button>

                {/* Dropdown Menu */}
                {isHotelSelectorOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsHotelSelectorOpen(false)} 
                    />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                       <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Switch Hotel</div>
                       
                       <div className="max-h-60 overflow-y-auto">
                         {hotelsList.map(hotel => (
                           <button
                             key={hotel.id}
                             onClick={() => handleSwitchHotel(hotel.id)}
                             className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${currentHotelId === hotel.id ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'}`}
                           >
                              <Building2 size={16} className="opacity-50" />
                              {hotel.name}
                              {currentHotelId === hotel.id && <CheckCircle size={14} className="ml-auto" />}
                           </button>
                         ))}
                       </div>

                       <div className="border-t border-slate-100 mt-2 pt-2 px-2 space-y-1">
                          <button 
                            onClick={() => { setIsHotelSelectorOpen(false); setIsCreateModalOpen(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                          >
                             <PlusCircle size={16} /> Create New Hotel
                          </button>
                          
                          <button 
                             onClick={() => { setIsHotelSelectorOpen(false); setIsTemplateModalOpen(true); }}
                             className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pink-600 hover:bg-pink-50 rounded-lg font-medium transition-colors"
                          >
                             <LayoutTemplate size={16} /> Save as Template
                          </button>
                       </div>
                    </div>
                  </>
                )}
             </div>
             
             {/* Connection Status */}
             <div className={`hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 border ${
               connectionStatus === 'connected' 
                 ? 'bg-green-50 text-green-700 border-green-200' 
                 : 'bg-slate-100 text-slate-500 border-slate-200'
             }`}>
                {connectionStatus === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
                {connectionStatus === 'connected' ? 'Cloud Sync' : 'Offline'}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
            
            {/* DESKTOP ACTIONS: Hidden on Mobile */}
            <div className="hidden md:flex items-center">
              
              <button 
                  onClick={() => setIsDataCheckOpen(true)}
                  className="flex items-center px-3 py-1.5 text-xs font-bold text-cyan-700 bg-cyan-100 rounded hover:bg-cyan-200 transition-all mr-2"
                  title="Compare DB vs Real World"
              >
                  <Scale size={14} className="mr-1.5" /> Data Check
              </button>

              <button 
                  onClick={() => setIsHealthModalOpen(true)}
                  className="flex items-center px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-all mr-2"
                  title="Check Data Health"
              >
                  <Activity size={14} className="mr-1.5" /> Health Check
              </button>

              <button 
                  onClick={() => setIsArchitectOpen(true)}
                  className="flex items-center px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded hover:shadow-md hover:scale-105 transition-all mr-2"
              >
                  <Sparkles size={14} className="mr-1.5" /> AI Architect
              </button>

              <div className="flex items-center gap-1 mr-2 border-r border-slate-200 pr-2">
                <button 
                    onClick={handleSaveToCloud} 
                    disabled={isSaving}
                    className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    title="Save to Cloud"
                >
                    {isSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />} 
                    Save
                </button>
              </div>

              <button onClick={handleImportClick} className="flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 mr-2">
                  <Upload size={14} className="mr-1.5" /> Import
              </button>
              
              {/* Export Dropdown */}
              <div className="relative">
                <button 
                   onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                   className="flex items-center px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                >
                   <Download size={14} className="mr-1.5" /> Export
                </button>
                {isExportMenuOpen && (
                   <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}/>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                          
                          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                              Standard
                          </div>
                          
                          <button 
                             onClick={() => handleExport('json')}
                             className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                             <FileJson size={14} className="text-amber-500" /> Backup JSON
                          </button>
                          
                          <button 
                             onClick={() => handleExport('csv')}
                             className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                             <FileSpreadsheet size={14} className="text-emerald-500" /> Excel / CSV
                          </button>

                          <div className="px-3 py-2 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 border-t border-slate-100">
                              AI Optimized
                          </div>

                          <button 
                             onClick={() => handleExport('clean-json')}
                             className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                             <Braces size={14} className="text-indigo-500" /> Clean JSON
                             <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1 rounded ml-auto">No IDs</span>
                          </button>

                          <button 
                             onClick={() => handleExport('txt')}
                             className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                          >
                             <FileText size={14} className="text-violet-500" /> Structured Text
                             <span className="text-[9px] bg-violet-50 text-violet-700 px-1 rounded ml-auto">RAG</span>
                          </button>

                      </div>
                   </>
                )}
              </div>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json"/>

            {/* MOBILE ACTIONS: Combined Dropdown */}
            <div className="relative md:hidden">
               <button 
                 onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
                 className={`p-2 rounded-lg transition-colors ${mobileToolsOpen ? 'bg-slate-200 text-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                 <Wrench size={20} />
               </button>

               {mobileToolsOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40" 
                     onClick={() => setMobileToolsOpen(false)} 
                   />
                   <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                        Tools & Actions
                      </div>

                      <button 
                        onClick={() => { setIsDataCheckOpen(true); setMobileToolsOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-cyan-600 hover:bg-cyan-50 font-medium"
                      >
                         <Scale size={16} /> Data Check
                      </button>

                      <button 
                        onClick={() => { setIsArchitectOpen(true); setMobileToolsOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-violet-600 hover:bg-violet-50 font-medium"
                      >
                         <Sparkles size={16} /> AI Architect
                      </button>

                      <button 
                        onClick={() => { setIsHealthModalOpen(true); setMobileToolsOpen(false); }}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-emerald-600 hover:bg-emerald-50 font-medium"
                      >
                         <Activity size={16} /> Health Check
                      </button>

                      <div className="my-1 border-t border-slate-100"></div>

                      <button 
                        onClick={handleSaveToCloud}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-blue-600 hover:bg-blue-50 font-medium"
                      >
                         <CloudUpload size={16} /> Save to Cloud
                      </button>

                      <button 
                        onClick={handleImportClick}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-slate-700 hover:bg-slate-50"
                      >
                         <Upload size={16} /> Import JSON
                      </button>

                      <div className="my-1 border-t border-slate-100"></div>
                      
                      <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase">Export Options</div>

                      <button 
                        onClick={() => handleExport('json')}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-slate-700 hover:bg-slate-50"
                      >
                         <FileJson size={16} /> Backup JSON
                      </button>

                      <button 
                        onClick={() => handleExport('clean-json')}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-slate-700 hover:bg-slate-50"
                      >
                         <Braces size={16} /> AI Clean JSON
                      </button>

                      <button 
                        onClick={() => handleExport('txt')}
                        className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 text-slate-700 hover:bg-slate-50"
                      >
                         <FileText size={16} /> AI Text (RAG)
                      </button>
                   </div>
                 </>
               )}
            </div>

            {/* Chat Toggle (Mobile) */}
            <button 
                onClick={() => setMobileChatOpen(!mobileChatOpen)} 
                className={`lg:hidden p-2 ml-1 rounded-full ${mobileChatOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`}
            >
                {mobileChatOpen ? <X size={20} /> : <MessageSquare size={20} />}
            </button>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
        
        {/* Navigation */}
        <div className={`
            absolute inset-0 z-20 bg-slate-50 border-r border-slate-200 transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-2 lg:block lg:h-full lg:min-h-0
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="h-full flex flex-col">
                <div className="h-20 px-4 border-b border-slate-200 bg-slate-100/50 flex justify-between items-center shrink-0">
                    <span className="text-xs font-bold text-slate-500 uppercase">Explorer</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden"><X size={16}/></button>
                </div>

                {/* SEARCH BAR */}
                <div className="p-3 border-b border-slate-100 bg-white sticky top-0 z-10">
                   <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
                        >
                          <X size={12} />
                        </button>
                      )}
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 min-h-0 pb-20 lg:min-h-0">
                    {/* Render Filtered Data */}
                    {filteredData && filteredData.children && filteredData.children.length > 0 ? (
                       <TreeViewNode 
                          node={filteredData} 
                          selectedId={selectedNodeId}
                          onSelect={(id) => {
                              setSelectedNodeId(id);
                              setMobileMenuOpen(false);
                          }}
                          onAddChild={handleAddChild}
                          forceExpand={!!searchQuery} // Auto expand when searching
                      />
                    ) : (
                       <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <Search size={24} className="text-slate-300 mb-2" />
                          <p className="text-xs font-medium text-slate-500">No results found.</p>
                          <p className="text-[10px] text-slate-400 mt-1">Try a different keyword.</p>
                          {searchQuery && (
                             <button onClick={() => setSearchQuery('')} className="mt-3 text-[10px] text-blue-600 hover:underline">
                               Clear Search
                             </button>
                          )}
                       </div>
                    )}
                </div>
            </div>
        </div>

        {/* Editor */}
        <div className="col-span-12 lg:col-span-7 bg-white h-full relative z-0 overflow-hidden min-h-0">
             <NodeEditor 
                node={selectedNode} 
                root={data}
                onUpdate={handleUpdateNode} 
                onDelete={handleDeleteNode}
             />
        </div>

        {/* Chatbot */}
        <div className={`
             absolute inset-0 z-20 bg-white transition-transform duration-300 lg:static lg:translate-x-0 lg:col-span-3 lg:block lg:h-full lg:min-h-0
             ${mobileChatOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
             <ChatBot key={currentHotelId || 'default'} data={data} />
        </div>
      </div>

      {/* FOOTER - STATUS BAR */}
      <footer className="bg-slate-50 border-t border-slate-200 text-xs text-slate-600 relative z-30 shrink-0">
        
        {/* Mobile Toggle Bar */}
        <div 
          className="lg:hidden h-10 flex items-center justify-between px-4 cursor-pointer hover:bg-slate-100 border-b border-slate-100"
          onClick={() => setMobileStatsOpen(!mobileStatsOpen)}
        >
          <div className="flex items-center gap-2">
             <Activity size={14} className={stats.completionRate >= 80 ? 'text-emerald-500' : 'text-amber-500'} />
             <span className="font-semibold">Data Health: {stats.completionRate}%</span>
          </div>
          <ChevronUp size={14} className={`transition-transform duration-300 ${mobileStatsOpen ? 'rotate-180' : ''}`} />
        </div>

        {/* Status Content */}
        <div className={`
          lg:h-10 lg:flex lg:items-center lg:justify-between lg:px-4
          ${mobileStatsOpen ? 'block p-4 border-b space-y-3' : 'hidden'}
        `}>
          
          {/* Section 1: Data Size */}
          <div className="flex items-center gap-4 lg:gap-6">
             <div className="flex items-center gap-1.5" title="Total nodes in the tree">
                <Database size={14} className="text-slate-400" />
                <span><span className="font-mono font-medium text-slate-800">{stats.totalNodes}</span> Elements</span>
             </div>
             <div className="hidden lg:flex items-center gap-1.5" title="Tree Depth">
                <Menu size={14} className="text-slate-400" />
                <span>Depth: <span className="font-mono font-medium text-slate-800">{stats.depth}</span></span>
             </div>
             {/* LAST SAVED TIMESTAMP */}
             <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-slate-300 ml-2" title="Last saved to Cloud">
                <Clock size={14} className={data.lastSaved ? "text-slate-600" : "text-slate-300"} />
                <span className="text-slate-500">Data Last Saved:</span>
                <span className="font-mono font-bold text-slate-800">{formatLastSaved(data.lastSaved)}</span>
             </div>
          </div>

          {/* Section 2: Progress */}
          <div className="flex items-center gap-4 flex-1 lg:justify-center">
             <div className="w-full max-w-xs flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                   <span>Completeness</span>
                   <span>{stats.completionRate}%</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-500 ${
                        stats.completionRate >= 80 ? 'bg-emerald-500' : 
                        stats.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                     }`} 
                     style={{ width: `${stats.completionRate}%` }}
                   />
                </div>
             </div>
          </div>

          {/* Section 3: Health & Warnings */}
          <div className="flex items-center gap-4 lg:gap-6 lg:justify-end">
             <div className="flex items-center gap-1.5 text-amber-600" title="Empty fields needing value">
                <AlertTriangle size={14} />
                <span className="font-mono font-medium">{stats.emptyItems}</span> Empty Fields
             </div>
             
             <div className="h-4 w-px bg-slate-300 hidden lg:block"></div>

             <div className="flex items-center gap-1.5">
                <PieChart size={14} className="text-slate-400" />
                <span className={`font-semibold ${
                   stats.completionRate >= 80 ? 'text-emerald-600' : 
                   stats.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                   {stats.completionRate >= 80 ? 'Excellent' : stats.completionRate >= 50 ? 'Good' : 'Needs Work'}
                </span>
             </div>
          </div>

        </div>
      </footer>
    </div>
  );
};

export default App;


import React, { useMemo, useState, useEffect } from 'react';
import { HotelNode, NodeType, NodeAttribute } from '../types';
import { analyzeHotelStats, findPathToNode, generateId } from '../utils/treeUtils';
import { generateNodeContext, generateValueFromAttributes } from '../services/geminiService';
import { validateNodeInput } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext';
import { 
  Tag, 
  Trash2, 
  LayoutDashboard,
  Box,
  BrainCircuit,
  Sparkles,
  Loader2,
  ChevronRight,
  Database,
  Check,
  Settings,
  List,
  FileText,
  CircleHelp,
  X,
  FolderOpen,
  Info,
  TriangleAlert,
  Wand2
} from 'lucide-react';

interface NodeEditorProps {
  node: HotelNode | null;
  root: HotelNode;
  onUpdate: (id: string, updates: Partial<HotelNode>) => void;
  onDelete: (id: string) => void;
}

// Helper for type descriptions - EDUCATIONAL LABELS
const getTypeInfo = (type: string) => {
  switch (type) {
    case 'category': return { 
        label: 'Category (Klasör)', 
        desc: 'İçinde başka öğeler barındıran bir kapsayıcıdır. Tek başına bir değeri yoktur (Örn: Restoranlar, Odalar).', 
        icon: <FolderOpen size={14} />,
        hint: 'Kategorilere fiyat veya içerik girmeyin.'
    };
    case 'list': return { 
        label: 'List (Liste)', 
        desc: 'Benzer öğelerin sıralandığı bir gruptur (Örn: TV Kanalları, Minibar İçeriği).', 
        icon: <List size={14} />,
        hint: 'Liste elemanlarını altına ekleyin.'
    };
    case 'item': return { 
        label: 'Item (Veri/Hizmet)', 
        desc: 'Tekil bir bilgi, hizmet veya üründür. Bir değeri ve özellikleri olur (Örn: Standart Oda, Check-in Saati).', 
        icon: <Box size={14} />,
        hint: 'Ana değeri ve özellikleri buraya girin.'
    };
    case 'menu': return { label: 'Menu', desc: 'Fiyatlı ürünlerin listesidir.', icon: <List size={14} />, hint: '' };
    case 'menu_item': return { label: 'Menu Item', desc: 'Menü içindeki fiyatlı ürün.', icon: <Box size={14} />, hint: '' };
    case 'field': return { label: 'Data Field', desc: 'Basit bir veri noktası.', icon: <Tag size={14} />, hint: '' };
    case 'qa_pair': return { label: 'Q&A', desc: 'Soru-Cevap çifti.', icon: <CircleHelp size={14} />, hint: '' };
    case 'note': return { label: 'Internal Note', desc: 'Yapay zeka için gizli not.', icon: <FileText size={14} />, hint: '' };
    case 'root': return { label: 'Root', desc: 'Ana Kök.', icon: <LayoutDashboard size={14} />, hint: '' };
    default: return { label: type, desc: 'Genel veri öğesi.', icon: <Box size={14} />, hint: '' };
  }
};

const NodeEditor: React.FC<NodeEditorProps> = ({ node, root, onUpdate, onDelete }) => {
  const { addChild } = useHotel();
  const stats = useMemo(() => node ? analyzeHotelStats(node) : null, [node]);
  const typeInfo = node ? getTypeInfo(String(node.type)) : { label: '', desc: '', icon: null, hint: '' };
  
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isGeneratingValue, setIsGeneratingValue] = useState(false); // New state for Value Assistant
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  useEffect(() => {
    setNewAttrKey('');
    setNewAttrValue('');
    setValidationError(null);
  }, [node?.id]);

  const breadcrumbs = useMemo(() => {
    if (!node || !root) return [];
    return findPathToNode(root, node.id) || [];
  }, [root, node]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50">
        <div className="bg-white p-6 rounded-full mb-4 shadow-sm border border-slate-100">
            <BrainCircuit size={48} className="opacity-20 text-indigo-500" />
        </div>
        <p className="text-sm font-medium">Explorer'dan düzenlemek istediğiniz öğeyi seçin.</p>
      </div>
    );
  }

  const handleChange = (field: keyof HotelNode, value: any) => {
    // REAL-TIME VALIDATION
    const potentialNode = { ...node, [field]: value };
    const error = validateNodeInput(potentialNode);
    setValidationError(error);

    onUpdate(node.id, { [field]: value });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(node.id);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAutoGenerateContext = async () => {
    setIsGeneratingContext(true);
    try {
      const pathString = breadcrumbs.map(b => b.name || 'Untitled').join(' > ');
      const result = await generateNodeContext(node, pathString);
      const currentTags = node.tags || [];
      const newTags = result.tags || [];
      const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

      onUpdate(node.id, {
        tags: mergedTags,
        description: result.description
      });
    } catch (error) {
      console.error("Failed to auto-generate context", error);
    } finally {
      setIsGeneratingContext(false);
    }
  };

  // NEW: AI Value Assistant
  const handleAutoGenerateValue = async () => {
    if (!node.attributes || node.attributes.length === 0) {
        alert("Önce 'Properties & Settings' kısmına birkaç özellik ekleyin.");
        return;
    }
    setIsGeneratingValue(true);
    try {
        const generatedText = await generateValueFromAttributes(node.name || '', node.attributes);
        onUpdate(node.id, { value: generatedText });
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingValue(false);
    }
  };

  const handleAddAttribute = () => {
    if (!newAttrKey.trim()) return;
    const newAttr: NodeAttribute = {
        id: generateId('attr'),
        key: newAttrKey.trim(),
        value: newAttrValue,
        type: 'text'
    };
    const currentAttributes = Array.isArray(node.attributes) ? [...node.attributes] : [];
    const updatedAttributes = [...currentAttributes, newAttr];
    onUpdate(node.id, { attributes: updatedAttributes });
    setNewAttrKey('');
    setNewAttrValue('');
  };

  const handleUpdateAttribute = (attrId: string, field: keyof NodeAttribute, value: string) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      const updated = currentAttributes.map(a => a.id === attrId ? { ...a, [field]: value } : a);
      onUpdate(node.id, { attributes: updated });
  };

  const handleDeleteAttribute = (attrId: string) => {
      const currentAttributes = Array.isArray(node.attributes) ? node.attributes : [];
      const updated = currentAttributes.filter(a => a.id !== attrId);
      onUpdate(node.id, { attributes: updated });
  };

  const handleAddSubContent = (type: 'qa_pair' | 'note' | 'field') => {
      addChild(node.id, type);
  };

  const subContentNodes = (node.children || []).filter(c => 
      ['qa_pair', 'note', 'field'].includes(String(c.type))
  );

  if (node.type === 'root') {
      return (
      <div className="h-full flex flex-col bg-slate-50/50">
        <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
          <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <LayoutDashboard size={20} className="text-blue-600"/>
               Dashboard
             </h2>
             <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">ROOT</span>
             </div>
          </div>
          <div className="text-right">
             <div className="text-sm font-medium text-slate-600">Total Elements</div>
             <div className="text-2xl font-bold text-slate-800 leading-none">{stats?.totalNodes || 0}</div>
          </div>
        </div>
        <div className="p-10 flex items-center justify-center text-slate-400">
            <p>Dinamik özellikleri düzenlemek için soldan bir öğe seçin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      
      {/* HEADER */}
      <div className="h-20 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
        <div className="flex-1 min-w-0 mr-4">
           <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
              {breadcrumbs.map((crumb, i) => (
                 <React.Fragment key={crumb.id}>
                    {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                    <span className={i === breadcrumbs.length - 1 ? "text-slate-800 font-bold" : "text-slate-500"}>
                       {crumb.name || 'Untitled'}
                    </span>
                 </React.Fragment>
              ))}
           </div>
           <h2 className="text-lg font-bold text-slate-800 truncate leading-none pb-0.5">
              {node.name || 'Untitled Node'}
           </h2>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex flex-col items-end relative group">
              <select 
                  value={node.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="text-xs font-bold uppercase tracking-wide border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-right pl-6 hover:bg-slate-100"
              >
                  <optgroup label="Containers">
                    <option value="category">Category (Klasör)</option>
                    <option value="list">List (Liste)</option>
                    <option value="menu">Menu (Fiyatlı)</option>
                  </optgroup>
                  <optgroup label="Data">
                    <option value="item">Item (Veri)</option>
                    <option value="menu_item">Menu Item</option>
                    <option value="field">Data Field</option>
                  </optgroup>
                  <optgroup label="Meta">
                    <option value="qa_pair">Q&A Pair</option>
                    <option value="note">Internal Note</option>
                  </optgroup>
              </select>
              
              {/* SMART TOOLTIP FOR TYPE */}
              <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                 <div className="font-bold mb-1 flex items-center gap-2">{typeInfo.icon} {typeInfo.label}</div>
                 <p className="opacity-90">{typeInfo.desc}</p>
                 {typeInfo.hint && <p className="mt-2 text-yellow-300 font-medium border-t border-slate-600 pt-1">{typeInfo.hint}</p>}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 cursor-help">
                 {typeInfo.icon} {typeInfo.label} <Info size={10} />
              </div>
           </div>
           <div className="h-8 w-px bg-slate-200 mx-1"></div>
           <button 
               onClick={handleDeleteClick}
               className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
           >
               <Trash2 size={18} />
           </button>
        </div>
      </div>

      {/* EDITOR BODY */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30">
        <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-8">
            
            {/* VALIDATION ALERT */}
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <TriangleAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-bold text-amber-800">Dikkat: Yapısal Uyumsuzluk</h4>
                        <p className="text-xs text-amber-700 mt-1">{validationError}</p>
                    </div>
                </div>
            )}

            {/* 1. MAIN IDENTITY */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Node Name / Title</label>
                    <div className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">ID: {node.id}</div>
                </div>
                <input 
                    type="text" 
                    value={node.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full bg-white text-xl font-bold text-slate-900 border-b-2 border-slate-100 px-2 py-2 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="e.g. Butler Service"
                />
                
                {/* Primary Value - HIDDEN FOR CATEGORIES */}
                {['qa_pair', 'note', 'field', 'item', 'menu_item'].includes(String(node.type)) && (
                    <div className="mt-4 relative group/value">
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  {node.type === 'qa_pair' ? 'Answer / Response' : 'Main Content / Value'}
                             </label>
                             {/* AI VALUE ASSISTANT BUTTON */}
                             <button 
                                onClick={handleAutoGenerateValue}
                                disabled={isGeneratingValue}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded border border-violet-100 transition-colors"
                                title="Özelliklerden (Attributes) otomatik içerik oluştur"
                             >
                                {isGeneratingValue ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />}
                                AI ile Oluştur
                             </button>
                        </div>
                        <textarea 
                            value={node.type === 'qa_pair' ? (node.answer || '') : (node.value || '')}
                            onChange={(e) => handleChange(node.type === 'qa_pair' ? 'answer' : 'value', e.target.value)}
                            rows={4}
                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            placeholder={isGeneratingValue ? "AI içerik yazıyor..." : "İçeriği buraya girin..."}
                        />
                         {node.type === 'qa_pair' && (
                             <input type="text" value={node.question || node.name || ''} onChange={(e) => handleChange('question', e.target.value)} className="hidden" />
                         )}
                    </div>
                )}
            </div>

            {/* 2. DYNAMIC ATTRIBUTES */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Properties & Settings</h3>
                    </div>
                    <span className="text-xs text-slate-400">{node.attributes?.length || 0} features</span>
                </div>
                
                <div className="p-6 space-y-3">
                    {node.attributes && node.attributes.map(attr => (
                        <div key={attr.id} className="flex items-center gap-3 group">
                            <div className="w-1/3 min-w-[120px]">
                                <input 
                                    type="text" 
                                    value={attr.key}
                                    onChange={(e) => handleUpdateAttribute(attr.id, 'key', e.target.value)}
                                    className="w-full text-xs font-bold text-slate-600 bg-slate-100 border-transparent rounded px-2 py-1.5 text-right focus:bg-white focus:border-blue-300"
                                />
                            </div>
                            <div className="flex-1">
                                <input 
                                    type="text" 
                                    value={attr.value}
                                    onChange={(e) => handleUpdateAttribute(attr.id, 'value', e.target.value)}
                                    className="w-full bg-white text-sm text-slate-800 border border-slate-200 rounded px-3 py-1.5 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <button 
                                onClick={() => handleDeleteAttribute(attr.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-2">
                         <div className="w-1/3 min-w-[120px]">
                            <input 
                                type="text" 
                                value={newAttrKey}
                                onChange={(e) => setNewAttrKey(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                                placeholder="New Property"
                                className="w-full text-xs text-slate-500 bg-white border border-slate-200 border-dashed rounded px-2 py-1.5 text-right focus:border-blue-400 outline-none"
                            />
                        </div>
                        <div className="flex-1 flex gap-2">
                            <input 
                                type="text" 
                                value={newAttrValue}
                                onChange={(e) => setNewAttrValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                                placeholder="Value"
                                className="flex-1 bg-white text-sm text-slate-600 border border-slate-200 border-dashed rounded px-3 py-1.5 focus:border-blue-400 outline-none"
                            />
                            <button onClick={handleAddAttribute} disabled={!newAttrKey.trim()} className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded text-xs font-bold transition-colors disabled:opacity-50">
                                <Check size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. SUB-CONTENT */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                 <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <List size={18} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Detailed Information & FAQs</h3>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleAddSubContent('qa_pair')} className="text-[10px] font-bold bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                            <CircleHelp size={12} /> Add Q&A
                        </button>
                        <button onClick={() => handleAddSubContent('note')} className="text-[10px] font-bold bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-600 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                            <FileText size={12} /> Add Note
                        </button>
                    </div>
                </div>
                <div className="p-2">
                    {subContentNodes.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm">No detailed notes or Q&As added yet.</div>
                    ) : (
                        <div className="space-y-2">
                             {subContentNodes.map(sub => (
                                 <div key={sub.id} className="group flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all">
                                     <div className={`mt-1 ${sub.type === 'qa_pair' ? 'text-green-500' : 'text-amber-500'}`}>
                                         {sub.type === 'qa_pair' ? <CircleHelp size={16}/> : <FileText size={16}/>}
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="flex justify-between">
                                            <span className="text-xs font-bold text-slate-700 truncate">{sub.type === 'qa_pair' ? (sub.question || sub.name) : sub.name}</span>
                                            <span className="text-[9px] uppercase font-bold text-slate-300">{sub.type}</span>
                                         </div>
                                         <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{sub.type === 'qa_pair' ? sub.answer : sub.value}</p>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 4. AI & METADATA */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
                 <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Context</label>
                    <button onClick={handleAutoGenerateContext} disabled={isGeneratingContext} className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 bg-white hover:bg-violet-50 px-2 py-1 rounded border border-slate-200 transition-colors">
                        {isGeneratingContext ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} Auto-Generate
                    </button>
                 </div>
                 <textarea 
                    value={node.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 outline-none text-slate-600 italic placeholder:text-slate-300"
                    placeholder="Hidden notes for the AI assistant..."
                 />
            </div>
            
            <div className="border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => handleCopyId(node.id)}>
                        <Database size={12} /> ID: <code className="bg-slate-100 px-1 rounded">{node.id}</code>
                        {copiedId === node.id && <Check size={10} className="text-emerald-500"/>}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default NodeEditor;

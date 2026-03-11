import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, Folder } from 'lucide-react';
import { HotelNode, HotelSummary } from '../types';
import { getHotelsList, fetchHotelById, updateHotelData } from '../services/firestoreService';
import { deepClone, generateId, checkIdExists } from '../utils/treeUtils';
import { useHotel } from '../contexts/HotelContext';

interface CopyToHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeToCopy: HotelNode | null;
}

const CopyToHotelModal: React.FC<CopyToHotelModalProps> = ({ isOpen, onClose, nodeToCopy }) => {
  const { hotelId: currentHotelId } = useHotel();
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [targetTree, setTargetTree] = useState<HotelNode | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>('root');
  
  const [isLoadingHotels, setIsLoadingHotels] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHotels();
      setSuccess(false);
      setError(null);
      setSelectedHotelId('');
      setTargetTree(null);
      setSelectedParentId('root');
    }
  }, [isOpen]);

  const loadHotels = async () => {
    setIsLoadingHotels(true);
    try {
      const list = await getHotelsList();
      // Exclude current hotel
      setHotels(list.filter(h => h.id !== currentHotelId));
    } catch (err) {
      setError("Oteller yüklenirken bir hata oluştu.");
    } finally {
      setIsLoadingHotels(false);
    }
  };

  const handleHotelSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hId = e.target.value;
    setSelectedHotelId(hId);
    setTargetTree(null);
    setSelectedParentId('root');
    
    if (!hId) return;

    setIsLoadingTree(true);
    try {
      const tree = await fetchHotelById(hId);
      setTargetTree(tree);
    } catch (err) {
      setError("Hedef otel verisi yüklenemedi.");
    } finally {
      setIsLoadingTree(false);
    }
  };

  // Helper to recursively regenerate IDs for a node and all its children
  const regenerateIds = (node: HotelNode, existingTree: HotelNode): HotelNode => {
    const clone = deepClone(node);
    
    const assignNewId = (n: HotelNode) => {
      // Generate a new ID based on type
      const prefix = n.type ? String(n.type).substring(0, 4) : 'node';
      let newId = generateId(prefix);
      
      // Ensure it doesn't exist in the target tree
      while (checkIdExists(existingTree, newId)) {
        newId = generateId(prefix);
      }
      
      n.id = newId;
      n.lastModified = Date.now();
      delete n.aiConfidence;
      
      if (n.children && n.children.length > 0) {
        n.children.forEach(assignNewId);
      }
    };
    
    assignNewId(clone);
    return clone;
  };

  // Helper to insert the node into the target tree
  const insertNodeIntoTree = (root: HotelNode, parentId: string, newNode: HotelNode): HotelNode => {
    if (root.id === parentId) {
      return {
        ...root,
        children: [...(root.children || []), newNode]
      };
    }
    
    if (root.children) {
      return {
        ...root,
        children: root.children.map(child => insertNodeIntoTree(child, parentId, newNode))
      };
    }
    
    return root;
  };

  const handleCopy = async () => {
    if (!selectedHotelId || !targetTree || !nodeToCopy) return;
    
    setIsCopying(true);
    setError(null);
    
    try {
      // 1. Clone and regenerate IDs for the node to copy
      const clonedNode = regenerateIds(nodeToCopy, targetTree);
      
      // 2. Insert into the target tree
      const updatedTree = insertNodeIntoTree(targetTree, selectedParentId, clonedNode);
      
      // 3. Save the updated tree to Firestore
      await updateHotelData(selectedHotelId, { ...updatedTree, lastSaved: Date.now() });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error(err);
      setError("Kopyalama işlemi sırasında bir hata oluştu.");
    } finally {
      setIsCopying(false);
    }
  };

  // Render a simple tree selector for the target parent
  const renderTreeOptions = (node: HotelNode, level = 0): React.ReactNode => {
    // Only show categories or root as potential parents to keep it clean, 
    // or show all nodes that can have children.
    const isContainer = node.id === 'root' || node.type === 'category' || node.type === 'section' || node.type === 'menu_category';
    
    const name = typeof node.name === 'object' ? (node.name.tr || node.name.en || node.id) : (node.name || node.id);
    
    return (
      <React.Fragment key={node.id}>
        {isContainer && (
          <option value={node.id}>
            {'\u00A0'.repeat(level * 4)} {level > 0 ? '└ ' : ''} {name}
          </option>
        )}
        {node.children?.map(child => renderTreeOptions(child, level + 1))}
      </React.Fragment>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Copy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Başka Otele Kopyala</h2>
              <p className="text-xs text-slate-500">Seçili öğeyi başka bir tesise aktarın</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <Check size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Başarıyla Kopyalandı!</h3>
              <p className="text-slate-500">Öğe hedef otele başarıyla aktarıldı.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Node Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <Folder className="text-slate-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Kopyalanacak Öğe</div>
                  <div className="font-medium text-slate-700">
                    {nodeToCopy ? (typeof nodeToCopy.name === 'object' ? (nodeToCopy.name.tr || nodeToCopy.name.en) : nodeToCopy.name) : ''}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Bu öğe ve altındaki tüm içerikler kopyalanacaktır.
                  </div>
                </div>
              </div>

              {/* Target Hotel Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Hedef Otel</label>
                {isLoadingHotels ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 p-3 border border-slate-200 rounded-xl">
                    <Loader2 size={16} className="animate-spin" /> Oteller yükleniyor...
                  </div>
                ) : (
                  <select
                    value={selectedHotelId}
                    onChange={handleHotelSelect}
                    className="w-full bg-white border border-slate-300 text-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  >
                    <option value="">-- Otel Seçin --</option>
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target Parent Selection */}
              {selectedHotelId && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Hedef Konum (Ebeveyn)</label>
                  {isLoadingTree ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 p-3 border border-slate-200 rounded-xl">
                      <Loader2 size={16} className="animate-spin" /> Hedef ağaç yükleniyor...
                    </div>
                  ) : targetTree ? (
                    <select
                      value={selectedParentId}
                      onChange={(e) => setSelectedParentId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow font-mono text-sm"
                    >
                      {renderTreeOptions(targetTree)}
                    </select>
                  ) : null}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isCopying}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleCopy}
              disabled={!selectedHotelId || !targetTree || isCopying}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isCopying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
              Kopyala
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopyToHotelModal;

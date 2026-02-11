
import React, { createContext, useContext, useState, useCallback } from 'react';
import { HotelNode } from '../types';
import { getInitialData, updateNodeInTree, addChildToNode, deleteNodeFromTree, generateId, moveNode as moveNodeInTree } from '../utils/treeUtils';
import { updateHotelData } from '../services/firestoreService';

interface HotelContextType {
  hotelData: HotelNode;
  hotelId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean; // Exposed for UI
  
  // Actions
  setHotelData: (data: HotelNode | ((prev: HotelNode) => HotelNode)) => void;
  setHotelId: (id: string | null) => void;
  updateNode: (nodeId: string, updates: Partial<HotelNode>) => void;
  addChild: (parentId: string, type?: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (sourceId: string, targetId: string, position: 'inside' | 'before' | 'after') => void;
  forceSave: () => Promise<void>;
}

const HotelContext = createContext<HotelContextType | undefined>(undefined);

export const HotelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- STATE ---
  const [hotelData, setHotelDataState] = useState<HotelNode>(getInitialData());
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  
  // Tracks if data has changed since last save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- ACTIONS (Wrapped in useCallback to prevent re-renders) ---

  const setHotelData = useCallback((data: HotelNode | ((prev: HotelNode) => HotelNode)) => {
    setHotelDataState((prev) => {
      if (typeof data === 'function') {
        return data(prev);
      }
      return data;
    });
    
    // If functional update, assume modification (unsaved changes). If object, assume load (no unsaved changes).
    if (typeof data === 'function') {
      setHasUnsavedChanges(true);
      setSaveStatus('idle'); // Changes happened, status is idle (waiting for save)
    } else {
      setHasUnsavedChanges(false);
      setSaveStatus('saved'); // Loaded data is technically saved
    }
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<HotelNode>) => {
    setHotelDataState((prev) => updateNodeInTree(prev, nodeId, updates));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  const addChild = useCallback((parentId: string, type: string = 'item') => {
    const newChild: HotelNode = {
      id: generateId(),
      type: type,
      name: 'New Item',
      value: ''
    };
    setHotelDataState((prev) => addChildToNode(prev, parentId, newChild));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return; // Protect root
    setHotelDataState((prev) => deleteNodeFromTree(prev, nodeId));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  const moveNode = useCallback((sourceId: string, targetId: string, position: 'inside' | 'before' | 'after') => {
    setHotelDataState((prev) => moveNodeInTree(prev, sourceId, targetId, position));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  // Removed aggressive useEffect auto-save.
  // Saving is now strictly manual or triggered by specific events if needed.

  // Manual Save
  const forceSave = async () => {
    if (!hotelId) return;
    
    setSaveStatus('saving');
    try {
        const now = Date.now();
        const dataToSave = { ...hotelData, lastSaved: now };
        await updateHotelData(hotelId, dataToSave);
        
        setLastSavedAt(now);
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setHotelDataState(prev => ({ ...prev, lastSaved: now }));
    } catch (e) {
        setSaveStatus('error');
        throw e;
    }
  };

  return (
    <HotelContext.Provider value={{
      hotelData,
      hotelId,
      setHotelId,
      setHotelData,
      updateNode,
      addChild,
      deleteNode,
      moveNode,
      saveStatus,
      lastSavedAt,
      hasUnsavedChanges,
      forceSave
    }}>
      {children}
    </HotelContext.Provider>
  );
};

export const useHotel = () => {
  const context = useContext(HotelContext);
  if (!context) {
    throw new Error('useHotel must be used within a HotelProvider');
  }
  return context;
};

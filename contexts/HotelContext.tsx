
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { HotelNode } from '../types';
import { getInitialData, updateNodeInTree, addChildToNode, deleteNodeFromTree, generateId, moveNode as moveNodeInTree } from '../utils/treeUtils';
import { updateHotelData } from '../services/firestoreService';

interface HotelContextType {
  hotelData: HotelNode;
  hotelId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  
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
  
  // Tracks if data has changed since last save to prevent loops
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Ref for Debounce Timer
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    } else {
      setHasUnsavedChanges(false);
    }
    setSaveStatus('idle');
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<HotelNode>) => {
    setHotelDataState((prev) => updateNodeInTree(prev, nodeId, updates));
    setHasUnsavedChanges(true);
    setSaveStatus('idle'); // Reset to idle to indicate change happened
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

  // --- AUTO-SAVE LOGIC (DEBOUNCED) ---
  useEffect(() => {
    // Only save if we have a valid ID and actual changes
    if (!hotelId || !hasUnsavedChanges) return;

    // Clear previous timer if exists (Debounce pattern)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    // Set new timer for 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`[AutoSave] Saving hotel ${hotelId}...`);
        
        // Add timestamp to data before saving
        const now = Date.now();
        const dataToSave = { ...hotelData, lastSaved: now };
        
        await updateHotelData(hotelId, dataToSave);
        
        // Update local state to reflect successful save
        setLastSavedAt(now);
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        
        // Update the lastSaved field in UI without triggering another save
        setHotelDataState(prev => ({ ...prev, lastSaved: now }));

      } catch (error) {
        console.error("[AutoSave] Failed:", error);
        setSaveStatus('error');
      }
    }, 2000); // 2000ms delay

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [hotelData, hotelId, hasUnsavedChanges]);

  // Manual Save (Bypasses debounce)
  const forceSave = async () => {
    if (!hotelId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
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

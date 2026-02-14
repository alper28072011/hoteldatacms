
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { HotelNode, AIPersona } from '../types';
import { getInitialData, updateNodeInTree, addChildToNode, deleteNodeFromTree, generateId, moveNode as moveNodeInTree, findNodeById, getSmartDefaultChildType } from '../utils/treeUtils';
import { updateHotelData, getPersonas, savePersona as savePersonaToDb, deletePersona as deletePersonaFromDb } from '../services/firestoreService';

interface HotelContextType {
  hotelData: HotelNode;
  hotelId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean; // Exposed for UI
  
  // Persona State
  personas: AIPersona[];
  activePersonaId: string;
  
  // Actions
  setHotelData: (data: HotelNode | ((prev: HotelNode) => HotelNode)) => void;
  setHotelId: (id: string | null) => void;
  updateNode: (nodeId: string, updates: Partial<HotelNode>) => void;
  addChild: (parentId: string, type?: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (sourceId: string, targetId: string, position: 'inside' | 'before' | 'after') => void;
  forceSave: () => Promise<void>;
  
  // Persona Actions
  addPersona: (persona: AIPersona) => Promise<void>;
  updatePersona: (persona: AIPersona) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  setActivePersonaId: (id: string) => void;
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

  // Persona State
  const [personas, setPersonas] = useState<AIPersona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');

  // Load Personas when Hotel ID changes
  useEffect(() => {
    const loadPersonas = async () => {
        if (hotelId) {
            const list = await getPersonas(hotelId);
            setPersonas(list);
        } else {
            setPersonas([]);
        }
        setActivePersonaId('default');
    };
    loadPersonas();
  }, [hotelId]);

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

  const addChild = useCallback((parentId: string, type?: string) => {
    setHotelDataState((prev) => {
      // SMART DEFAULT TYPE
      let finalType = type;
      if (!finalType) {
          const parentNode = findNodeById(prev, parentId);
          finalType = parentNode ? getSmartDefaultChildType(String(parentNode.type)) : 'item';
      }

      const newChild: HotelNode = {
        id: generateId(),
        type: finalType,
        name: finalType === 'menu_item' ? 'Yeni Ürün' : 'Yeni Öğe',
        value: ''
      };
      
      return addChildToNode(prev, parentId, newChild);
    });
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

  // Persona Actions
  const addPersona = useCallback(async (persona: AIPersona) => {
      if (!hotelId) return;
      // Optimistic update
      setPersonas(prev => [...prev, persona]);
      await savePersonaToDb(hotelId, persona);
  }, [hotelId]);

  const updatePersona = useCallback(async (persona: AIPersona) => {
      if (!hotelId) return;
      setPersonas(prev => prev.map(p => p.id === persona.id ? persona : p));
      await savePersonaToDb(hotelId, persona);
  }, [hotelId]);

  const deletePersona = useCallback(async (id: string) => {
      if (!hotelId) return;
      setPersonas(prev => prev.filter(p => p.id !== id));
      if (activePersonaId === id) setActivePersonaId('default');
      await deletePersonaFromDb(hotelId, id);
  }, [hotelId, activePersonaId]);

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
      forceSave,
      personas,
      activePersonaId,
      setActivePersonaId,
      addPersona,
      updatePersona,
      deletePersona
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

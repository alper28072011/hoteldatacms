
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { HotelNode, AIPersona, NodeTemplate } from '../types';
import { getInitialData, updateNodeInTree, addChildToNode, deleteNodeFromTree, generateId, moveNode as moveNodeInTree, findNodeById, getSmartDefaultChildType, checkIdExists } from '../utils/treeUtils';
import { 
  updateHotelData, 
  getPersonas, 
  savePersona as savePersonaToDb, 
  deletePersona as deletePersonaFromDb, 
  getNodeTemplates, 
  saveNodeTemplate as saveNodeTemplateToDb, // Aliased to prevent collision
  deleteNodeTemplate as deleteNodeTemplateFromDb // Aliased to prevent collision
} from '../services/firestoreService';

interface HotelContextType {
  hotelData: HotelNode;
  hotelId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean; // Exposed for UI
  
  // UI Preferences
  displayLanguage: 'tr' | 'en';
  setDisplayLanguage: (lang: 'tr' | 'en') => void;

  // Persona State
  personas: AIPersona[];
  activePersonaId: string;
  
  // Template State
  nodeTemplates: NodeTemplate[];

  // Actions
  setHotelData: (data: HotelNode | ((prev: HotelNode) => HotelNode)) => void;
  setHotelId: (id: string | null) => void;
  updateNode: (nodeId: string, updates: Partial<HotelNode>) => void;
  changeNodeId: (oldId: string, newId: string) => Promise<{ success: boolean; message: string }>;
  addChild: (parentId: string, type?: string) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (sourceId: string, targetId: string, position: 'inside' | 'before' | 'after') => void;
  forceSave: () => Promise<void>;
  
  // Persona Actions
  addPersona: (persona: AIPersona) => Promise<void>;
  updatePersona: (persona: AIPersona) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  setActivePersonaId: (id: string) => void;

  // Template Actions
  addNodeTemplate: (template: NodeTemplate) => Promise<void>;
  updateNodeTemplate: (template: NodeTemplate) => Promise<void>;
  deleteNodeTemplate: (id: string) => Promise<void>;
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
  
  // UI State
  const [displayLanguage, setDisplayLanguage] = useState<'tr' | 'en'>('tr');

  // Persona State
  const [personas, setPersonas] = useState<AIPersona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');

  // Node Templates State
  const [nodeTemplates, setNodeTemplates] = useState<NodeTemplate[]>([]);

  // Load Personas & Templates when Hotel ID changes
  useEffect(() => {
    const loadSubCollections = async () => {
        if (hotelId) {
            const pList = await getPersonas(hotelId);
            setPersonas(pList);
            const tList = await getNodeTemplates(hotelId);
            setNodeTemplates(tList);
        } else {
            setPersonas([]);
            setNodeTemplates([]);
        }
        setActivePersonaId('default');
    };
    loadSubCollections();
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
    // Automatically inject the current timestamp for granular tracking
    const timestampedUpdates = { ...updates, lastModified: Date.now() };
    setHotelDataState((prev) => updateNodeInTree(prev, nodeId, timestampedUpdates));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, []);

  const changeNodeId = useCallback(async (oldId: string, newId: string): Promise<{ success: boolean; message: string }> => {
    // 1. Validation
    if (!newId || newId.trim() === '') return { success: false, message: 'ID cannot be empty.' };
    if (oldId === newId) return { success: true, message: 'ID is unchanged.' };
    
    // 2. Uniqueness Check
    if (checkIdExists(hotelData, newId)) {
        return { success: false, message: 'This ID already exists in the tree.' };
    }

    // 3. Apply Update
    // We reuse updateNodeInTree which finds node by OLD ID and applies the NEW ID in updates
    // Also update timestamp
    setHotelDataState((prev) => updateNodeInTree(prev, oldId, { id: newId, lastModified: Date.now() }));
    
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
    
    return { success: true, message: 'ID updated successfully.' };
  }, [hotelData]);

  const addChild = useCallback((parentId: string, type?: string) => {
    setHotelDataState((prev) => {
      // SMART DEFAULT TYPE
      let finalType = type;
      if (!finalType) {
          const parentNode = findNodeById(prev, parentId);
          finalType = parentNode ? getSmartDefaultChildType(String(parentNode.type)) : 'item';
      }

      // Slightly smarter default ID generation to assist with context
      const prefix = finalType ? finalType.substring(0, 4) : 'node';
      const newChild: HotelNode = {
        id: generateId(prefix),
        type: finalType,
        name: { tr: finalType === 'menu_item' ? 'Yeni Ürün' : 'Yeni Öğe', en: finalType === 'menu_item' ? 'New Item' : 'New Node' },
        value: { tr: '', en: '' },
        lastModified: Date.now() // Initial timestamp
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
        // Update root lastSaved, but don't overwrite individual node lastModified unless changed
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

  // Template Actions
  const addNodeTemplate = useCallback(async (template: NodeTemplate) => {
      if (!hotelId) return;
      setNodeTemplates(prev => [...prev, template]);
      await saveNodeTemplateToDb(hotelId, template); // Fixed call
  }, [hotelId]);

  const updateNodeTemplate = useCallback(async (template: NodeTemplate) => {
      if (!hotelId) return;
      setNodeTemplates(prev => prev.map(t => t.id === template.id ? template : t));
      await saveNodeTemplateToDb(hotelId, template); // Fixed call
  }, [hotelId]);

  const deleteNodeTemplate = useCallback(async (id: string) => {
      if (!hotelId) return;
      setNodeTemplates(prev => prev.filter(t => t.id !== id));
      await deleteNodeTemplateFromDb(hotelId, id); // Fixed call
  }, [hotelId]);

  return (
    <HotelContext.Provider value={{
      hotelData,
      hotelId,
      setHotelId,
      setHotelData,
      updateNode,
      changeNodeId,
      addChild,
      deleteNode,
      moveNode,
      saveStatus,
      lastSavedAt,
      hasUnsavedChanges,
      forceSave,
      displayLanguage,
      setDisplayLanguage,
      personas,
      activePersonaId,
      setActivePersonaId,
      addPersona,
      updatePersona,
      deletePersona,
      nodeTemplates,
      addNodeTemplate,
      updateNodeTemplate,
      deleteNodeTemplate
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

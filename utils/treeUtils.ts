
import { HotelNode, EventData, DiningData, RoomData, NodeType } from "../types";

// Generate a simple unique ID with high collision resistance
export const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Modern, fast deep clone using native browser API
export const deepClone = <T>(obj: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
};

// --- TYPE CONSTRAINTS & LOGIC ---

export const isLeafNode = (type: string): boolean => {
    return ['item', 'field', 'menu_item', 'qa_pair', 'note', 'policy'].includes(type);
};

export const getSmartDefaultChildType = (parentType: string): string => {
    switch (parentType) {
        case 'menu': return 'menu_item';
        case 'list': return 'item';
        case 'category': return 'item';
        case 'root': return 'category';
        default: return 'item';
    }
};

export const getAllowedTypes = (parentType?: string): string[] => {
    // If no parent (root level editing) or root parent
    if (!parentType || parentType === 'root') {
        return ['category', 'list', 'menu', 'policy', 'note', 'qa_pair'];
    }

    switch (parentType) {
        case 'category':
            return ['category', 'list', 'menu', 'item', 'field', 'note', 'policy', 'event', 'qa_pair'];
        case 'list':
            return ['item'];
        case 'menu':
            return ['menu_item']; // Menus should strictly contain menu items (or subsections if really needed, but sticking to strict for now)
        default:
            return []; // Leaf nodes shouldn't have children types
    }
};

// Find a node by ID - Optimized for read-only access
export const findNodeById = (root: HotelNode, id: string): HotelNode | null => {
  if (String(root.id) === String(id)) return root;
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      const found = findNodeById(root.children[i], id);
      if (found) return found;
    }
  }
  return null;
};

// Find the full path from root to a specific node
export const findPathToNode = (root: HotelNode, targetId: string): HotelNode[] | null => {
  if (String(root.id) === String(targetId)) {
    return [root];
  }
  
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      const path = findPathToNode(root.children[i], targetId);
      if (path) {
        return [root, ...path];
      }
    }
  }
  
  return null;
};

export const updateNodeInTree = (root: HotelNode, targetId: string, updates: Partial<HotelNode>): HotelNode => {
  if (String(root.id) === String(targetId)) {
    return { ...root, ...updates };
  }

  if (!root.children) {
    return root;
  }

  let hasChanges = false;
  const newChildren = root.children.map(child => {
    const updatedChild = updateNodeInTree(child, targetId, updates);
    if (updatedChild !== child) {
      hasChanges = true;
      return updatedChild;
    }
    return child;
  });

  if (!hasChanges) {
    return root;
  }

  return { ...root, children: newChildren };
};

export const addChildToNode = (root: HotelNode, parentId: string, newChild: HotelNode): HotelNode => {
  if (String(root.id) === String(parentId)) {
    return {
      ...root,
      children: root.children ? [...root.children, newChild] : [newChild]
    };
  }

  if (!root.children) {
    return root;
  }

  let hasChanges = false;
  const newChildren = root.children.map(child => {
    const updatedChild = addChildToNode(child, parentId, newChild);
    if (updatedChild !== child) {
      hasChanges = true;
      return updatedChild;
    }
    return child;
  });

  return hasChanges ? { ...root, children: newChildren } : root;
};

export const deleteNodeFromTree = (root: HotelNode, nodeIdToDelete: string): HotelNode => {
  if (String(root.id) === String(nodeIdToDelete)) {
    return root; 
  }

  if (!root.children) return root;

  const childIndex = root.children.findIndex(c => String(c.id) === String(nodeIdToDelete));
  
  if (childIndex !== -1) {
    const newChildren = [...root.children];
    newChildren.splice(childIndex, 1);
    return { ...root, children: newChildren };
  }

  let hasChanges = false;
  const newChildren = root.children.map(child => {
    const updatedChild = deleteNodeFromTree(child, nodeIdToDelete);
    if (updatedChild !== child) {
      hasChanges = true;
      return updatedChild;
    }
    return child;
  });

  return hasChanges ? { ...root, children: newChildren } : root;
};

const insertNodeSibling = (root: HotelNode, targetId: string, newNode: HotelNode, position: 'before' | 'after'): HotelNode => {
  if (String(root.id) === String(targetId)) return root; 

  if (!root.children) return root;

  const index = root.children.findIndex(c => String(c.id) === String(targetId));
  
  if (index !== -1) {
    const newChildren = [...root.children];
    const insertIndex = position === 'before' ? index : index + 1;
    newChildren.splice(insertIndex, 0, newNode);
    return { ...root, children: newChildren };
  }

  let hasChanges = false;
  const newChildren = root.children.map(child => {
    const updatedChild = insertNodeSibling(child, targetId, newNode, position);
    if (updatedChild !== child) {
      hasChanges = true;
      return updatedChild;
    }
    return child;
  });

  return hasChanges ? { ...root, children: newChildren } : root;
};

export const moveNode = (root: HotelNode, sourceId: string, targetId: string, position: 'inside' | 'before' | 'after'): HotelNode => {
  if (sourceId === targetId) return root;
  if (sourceId === 'root') return root; 
  if (targetId === 'root' && position !== 'inside') return root; 

  const sourceNode = findNodeById(root, sourceId);
  if (!sourceNode) return root;

  const targetPath = findPathToNode(root, targetId);
  if (targetPath && targetPath.some(n => n.id === sourceId)) {
    console.warn("Cannot move a node into its own descendant");
    return root;
  }

  // VALIDATE PARENT CONSTRAINT FOR MOVE
  // If moving 'inside', target is the parent. If 'before/after', target's parent is the parent.
  let newParent: HotelNode | null = null;
  if (position === 'inside') {
      newParent = findNodeById(root, targetId);
  } else {
      const path = findPathToNode(root, targetId);
      if (path && path.length > 1) {
          newParent = path[path.length - 2];
      }
  }

  // STRICT TYPE CHECK ON MOVE
  if (newParent) {
      const allowedTypes = getAllowedTypes(String(newParent.type));
      if (!allowedTypes.includes(String(sourceNode.type)) && allowedTypes.length > 0) {
          // If the type is not allowed, we block the move logic by returning original root.
          // In a real app, we might want to throw an error or return a status.
          console.warn(`Move blocked: ${sourceNode.type} cannot be inside ${newParent.type}`);
          return root;
      }
  }

  const treeWithoutSource = deleteNodeFromTree(root, sourceId);

  if (position === 'inside') {
     return addChildToNode(treeWithoutSource, targetId, sourceNode);
  } else {
     return insertNodeSibling(treeWithoutSource, targetId, sourceNode, position);
  }
};

export const getInitialData = (): HotelNode => ({
  id: "root",
  type: "root",
  name: "Yeni Otel",
  attributes: [],
  children: [
    {
      id: "gen-info",
      type: "category",
      name: "Genel Bilgiler",
      children: [
        {
          id: "g1",
          type: "field",
          name: "Otel Adı",
          value: "Grand React Hotel",
          attributes: [
            { id: 'attr-1', key: 'Yıldız', value: '5', type: 'number' }
          ]
        }
      ]
    }
  ]
});

export const regenerateIds = (node: HotelNode): HotelNode => {
  const newNode = { ...node, id: generateId(node.type.substring(0, 3)) };
  if (node.children) {
    newNode.children = node.children.map(child => regenerateIds(child));
  }
  return newNode;
};

export const cleanTreeValues = (node: HotelNode): HotelNode => {
  const newNode = { ...node };
  delete newNode.value;
  delete newNode.price;
  delete newNode.answer;
  delete newNode.data; // Clean structured data too
  delete newNode.description;
  if (newNode.attributes) {
      newNode.attributes = newNode.attributes.map(attr => ({ ...attr, value: '' }));
  }

  if (node.children) {
    newNode.children = node.children.map(child => cleanTreeValues(child));
  }
  return newNode;
};

export interface HotelStats {
  totalNodes: number;
  categories: number;
  fillableItems: number;
  emptyItems: number;
  completionRate: number;
  depth: number;
}

export const analyzeHotelStats = (root: HotelNode): HotelStats => {
  let stats: HotelStats = {
    totalNodes: 0,
    categories: 0,
    fillableItems: 0,
    emptyItems: 0,
    completionRate: 0,
    depth: 0
  };

  const traverse = (node: HotelNode, currentDepth: number) => {
    stats.totalNodes++;
    stats.depth = Math.max(stats.depth, currentDepth);
    const type = String(node.type);
    
    if (type === 'category' || type === 'root' || type === 'menu' || type === 'list') {
      stats.categories++;
    } else {
      stats.fillableItems++;
      let isEmpty = false;
      if (type === 'qa_pair') {
         if (!node.answer || !node.answer.trim()) isEmpty = true;
      } else if (type === 'menu_item') {
         if (!node.price) isEmpty = true;
      } else {
         if ((!node.value || !node.value.trim()) && !node.data) isEmpty = true;
      }
      if (isEmpty) stats.emptyItems++;
    }

    if (node.children) {
      node.children.forEach(child => traverse(child, currentDepth + 1));
    }
  };

  traverse(root, 1);
  if (stats.fillableItems > 0) {
    stats.completionRate = Math.round(((stats.fillableItems - stats.emptyItems) / stats.fillableItems) * 100);
  } else {
    stats.completionRate = 100;
  }
  return stats;
};

export const filterHotelTree = (node: HotelNode, query: string): HotelNode | null => {
  if (!query) return node;

  const lowerQuery = query.toLowerCase();
  
  const nameMatch = (node.name || '').toLowerCase().includes(lowerQuery);
  const valueMatch = (node.value || '').toLowerCase().includes(lowerQuery);
  const tagsMatch = node.tags?.some(tag => (tag || '').toLowerCase().includes(lowerQuery));
  const attributesMatch = node.attributes?.some(attr => 
    (attr.key || '').toLowerCase().includes(lowerQuery) || 
    (attr.value || '').toLowerCase().includes(lowerQuery)
  );
  
  const isMatch = nameMatch || valueMatch || tagsMatch || attributesMatch;

  let filteredChildren: HotelNode[] = [];
  if (node.children) {
    filteredChildren = node.children
      .map(child => filterHotelTree(child, query))
      .filter((child): child is HotelNode => child !== null);
  }

  if (isMatch || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren 
    };
  }
  return null;
};

// --- DATA PROCESSING HELPERS FOR GENERATE AI TEXT ---

interface GlobalIndex {
  definitions: Map<string, string>; 
  globalRules: string[];
}

const buildGlobalIndex = (root: HotelNode): GlobalIndex => {
  const index: GlobalIndex = {
    definitions: new Map(),
    globalRules: []
  };

  const traverse = (node: HotelNode) => {
    // Index definable items
    if (['list', 'menu', 'policy', 'category'].includes(String(node.type))) {
      const name = node.name?.trim();
      if (name && name.length > 3) {
        const childrenSummary = node.children
          ?.map(c => c.name + (c.value ? `: ${c.value}` : ''))
          .slice(0, 5) 
          .join(', ');
        
        if (childrenSummary) {
          index.definitions.set(name, childrenSummary);
        }
      }
    }

    if (node.name?.toLowerCase().includes('general rule') || node.tags?.includes('global')) {
       if (node.children) {
          node.children.forEach(c => {
             if (c.value) index.globalRules.push(`${c.name}: ${c.value}`);
          });
       }
    }

    if (node.children) node.children.forEach(traverse);
  };

  traverse(root);
  return index;
};

const translateSchemaToNaturalLanguage = (node: HotelNode): string => {
    if (!node.schemaType || !node.data) return '';

    const { schemaType, data } = node;

    // --- EVENT TRANSLATOR ---
    if (schemaType === 'event') {
        const d = data as EventData;
        
        if (d.status === 'cancelled') return `[ETKİNLİK İPTAL] Bu etkinlik iptal edildi. Neden: ${d.statusReason || 'Belirtilmedi'}.`;
        if (d.status === 'moved') return `[ETKİNLİK TAŞINDI] Yeni yer: ${d.location}.`;

        let scheduleText = "";
        const s = d.schedule;
        
        if (!s) return `[AKTİVİTE: ${node.name}] Takvim bilgisi eksik.`;

        if (s.frequency === 'daily') {
            scheduleText = "HER GÜN.";
        } else if (s.frequency === 'weekly') {
            scheduleText = `HAFTALIK: ${s.activeDays?.join(', ')} günleri.`;
        } else if (s.frequency === 'biweekly') {
            scheduleText = `İKİ HAFTADA BİR: ${s.activeDays?.join(', ')} günleri.`;
        } else if (s.frequency === 'once') {
            scheduleText = `TEK SEFERLİK: Tarih ${s.validFrom}.`;
        }

        if (s.validFrom && s.validUntil) scheduleText += ` Geçerlilik: ${s.validFrom} - ${s.validUntil} arası.`;
        
        const time = s.startTime ? `${s.startTime}${s.endTime ? ` - ${s.endTime}` : ''}` : 'Saat değişebilir';
        const cost = d.isPaid ? `ÜCRETLİ (${d.price || 'Fiyat sorunuz'})` : 'ÜCRETSİZ';
        const audience = d.ageGroup === 'all' ? 'Herkes' : d.ageGroup === 'kids' ? 'SADECE ÇOCUK (4-12)' : d.ageGroup === 'adults' ? 'SADECE YETİŞKİN (18+)' : 'Genç';

        return `[AKTİVİTE: ${node.name}] ${scheduleText} Saat: ${time}. Konum: ${d.location}. Kitle: ${audience}. ${cost}. ${d.requiresReservation ? 'Rezervasyon Gerekli.' : ''}`;
    }

    // --- DINING TRANSLATOR ---
    if (schemaType === 'dining') {
        const d = data as DiningData;
        const shifts = d.shifts?.map(s => `${s.name}: ${s.start}-${s.end}`).join(', ');
        const concept = d.concept === 'all_inclusive' ? 'Her Şey Dahil Kapsamında' : 'Ekstra Ücretli';
        
        const feats = [];
        if (d.features?.hasKidsMenu) feats.push("Çocuk Menüsü");
        if (d.features?.hasVeganOptions) feats.push("Vegan Seçenek");
        if (d.features?.hasGlutenFreeOptions) feats.push("Glutensiz");
        
        return `[RESTORAN: ${node.name}] Tip: ${d.type}. Mutfak: ${d.cuisine}. Saatler: ${shifts}. Konsept: ${concept}. Kıyafet: ${d.dressCode}. İmkanlar: ${feats.join(', ')}. Öne Çıkanlar: ${d.menuHighlights?.join(', ')}.`;
    }

    // --- ROOM TRANSLATOR ---
    if (schemaType === 'room') {
        const d = data as RoomData;
        const balc = d.hasBalcony ? 'Balkonlu' : 'Balkonsuz';
        const occ = `Kapasite: ${d.maxOccupancy?.adults} Yetişkin + ${d.maxOccupancy?.children} Çocuk`;
        
        return `[ODA TİPİ: ${node.name}] Boyut: ${d.sizeSqM}m². ${occ}. Manzara: ${d.view}. Yatak: ${d.bedConfiguration}. ${balc}. Donanım: ${d.amenities?.join(', ')}. Minibar: ${d.minibarContent?.join(', ')}.`;
    }

    return '';
}

export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  
  const globalIndex = buildGlobalIndex(root);
  
  const flattenTree = (node: HotelNode, depth: number): { node: HotelNode, depth: number }[] => {
    const result: { node: HotelNode, depth: number }[] = [{ node, depth }];
    if (node.children) {
      node.children.forEach(child => result.push(...flattenTree(child, depth + 1)));
    }
    return result;
  };

  const flatNodes = flattenTree(root, 0);
  const totalNodes = flatNodes.length;
  const lines: string[] = [];
  const CHUNK_SIZE = 50;

  for (let i = 0; i < totalNodes; i++) {
    const { node, depth } = flatNodes[i];
    const type = String(node.type);
    const name = node.name || 'İsimsiz';
    const value = node.value || node.answer || '';
    
    const indent = "  ".repeat(depth);
    let line = "";

    const isContainer = ['root', 'category', 'list', 'menu'].includes(type);
    
    if (isContainer) {
       if (depth < 3) {
         line = `\n${"#".repeat(depth + 1)} ${name}`;
       } else {
         line = `${indent}- **[${type.toUpperCase()}] ${name}**`;
       }
    } else {
       line = `${indent}- ${name}`;
    }

    if (value) {
      line += `: ${value}`;
      
      const definition = globalIndex.definitions.get(value.trim());
      if (definition && type !== 'list' && type !== 'menu') {
        line += ` _(Sistem Tanımı: ${definition}...)_`;
      }
    }

    if (node.schemaType && node.data) {
        const translatedText = translateSchemaToNaturalLanguage(node);
        if (translatedText) {
            line += `\n${indent}  > AI_NOTU: ${translatedText}`;
        }
    }

    const attributesParts: string[] = [];
    if (node.price) attributesParts.push(`Fiyat: ${node.price}`);
    if (node.attributes && node.attributes.length > 0) {
       node.attributes.forEach(attr => {
          if (attr.key && attr.value) {
             attributesParts.push(`${attr.key}: ${attr.value}`);
          }
       });
    }
    if (attributesParts.length > 0) {
       line += ` [${attributesParts.join(', ')}]`;
    }

    if (type === 'category' && (name.toLowerCase().includes('oda') || name.toLowerCase().includes('room'))) {
       if (globalIndex.globalRules.length > 0) {
         line += `\n${indent}  > *Global Kurallar Uygulandı: ${globalIndex.globalRules.length} madde.*`;
       }
    }

    lines.push(line);

    if (node.description) {
       lines.push(`${indent}  > Not: ${node.description}`);
    }

    if (i % CHUNK_SIZE === 0) {
      onProgress(Math.round((i / totalNodes) * 100));
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  return lines.join('\n');
};

export const generateCleanAIJSON = (node: HotelNode, parentPath: string = ''): any => {
  const semanticData: any = {};
  
  const safeCopy = (val: any, depth: number): any => {
      if (depth > 5) return undefined; 
      if (val === null || val === undefined) return val;
      if (typeof val !== 'object') return val;
      if (Array.isArray(val)) return val.map(v => safeCopy(v, depth + 1));
      if (val.constructor && val.constructor !== Object) return undefined;
      
      const res: any = {};
      for (const k in val) {
          if (Object.prototype.hasOwnProperty.call(val, k)) {
              const safeVal = safeCopy(val[k], depth + 1);
              if (safeVal !== undefined) res[k] = safeVal;
          }
      }
      return res;
  }

  if (node.id) semanticData.id = node.id;
  if (node.type) semanticData.type = node.type;
  if (node.name) semanticData.name = node.name;
  if (node.value) semanticData.value = node.value;
  if (node.description) semanticData.description = node.description; 
  if (node.tags) semanticData.tags = node.tags;
  
  if (node.schemaType) semanticData.schemaType = node.schemaType;
  if (node.data) semanticData.data = safeCopy(node.data, 0);

  if (node.attributes && Array.isArray(node.attributes)) {
      semanticData.attributes = node.attributes.map(a => ({
          key: a.key,
          value: a.value
      }));
  }

  const currentPath = parentPath ? `${parentPath} > ${node.name || 'İsimsiz'}` : (node.name || 'İsimsiz');
  semanticData._path = currentPath;

  if (node.children && node.children.length > 0) {
    semanticData.contains = node.children.map((child: HotelNode) => generateCleanAIJSON(child, currentPath));
  }

  return semanticData;
};

export const generateOptimizedCSV = async (root: HotelNode, onProgress: (percent: number) => void): Promise<string> => {
  const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[] }[] => {
    const result: { node: HotelNode, path: string[] }[] = [];
    const traverse = (node: HotelNode, path: string[]) => {
      const currentPath = [...path, node.name || 'İsimsiz'];
      result.push({ node, path: currentPath });
      if (node.children) node.children.forEach(child => traverse(child, currentPath));
    };
    traverse(root, []);
    return result;
  };

  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const headers = ['Sistem_ID', 'Yol', 'Tip', 'Şema', 'İsim', 'Değer', 'Özellikler', 'Yapısal_Veri'];
  const rows: string[] = ['\uFEFF' + headers.join(',')]; 

  const safeCSV = (val: any) => {
    const s = String(val || '').replace(/"/g, '""');
    return `"${s}"`;
  };

  for (let i = 0; i < totalNodes; i++) {
     const { node, path } = flatNodes[i];
     rows.push([
        safeCSV(node.id),
        safeCSV(path.join(' > ')),
        safeCSV(node.type),
        safeCSV(node.schemaType || 'generic'),
        safeCSV(node.name),
        safeCSV(node.value),
        safeCSV(JSON.stringify(node.attributes || [])),
        safeCSV(node.data ? JSON.stringify(node.data) : '')
     ].join(','));
     
     if (i % 50 === 0) {
       onProgress(Math.round((i / totalNodes) * 100));
       await new Promise(r => setTimeout(r, 5));
     }
  }
  return rows.join('\n');
};

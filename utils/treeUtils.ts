

import { HotelNode, EventData, DiningData, RoomData, NodeType, LocalizedText } from "../types";

// Generate a simple unique ID with high collision resistance
// Updated to accept a custom prefix derived from content
export const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

// Converts human readable text to a safe ID slug (e.g. "Main Pool Rules" -> "main-pool-rules")
export const generateSlug = (text: string | LocalizedText | undefined): string => {
  const str = typeof text === 'object' ? text.tr : (text || '');
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces and non-word chars with -
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing -
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c'); // Turkish char support
};

// --- MULTI-LANGUAGE UTILITIES ---

/**
 * Returns a localized string. Falls back to TR, then EN, then empty string.
 * Handles both legacy string data and new LocalizedText objects.
 */
export const getLocalizedValue = (val: LocalizedText | string | undefined, lang: 'tr' | 'en'): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val[lang] || val['tr'] || val['en'] || '';
};

/**
 * Ensures data is in LocalizedText format. Used for migration on read/write.
 */
export const ensureLocalized = (val: LocalizedText | string | undefined): LocalizedText => {
  if (!val) return { tr: '', en: '' };
  if (typeof val === 'string') return { tr: val, en: '' };
  return { tr: val.tr || '', en: val.en || '', ...val };
};

/**
 * Formats text for AI Context as "Turkish (English)" if both exist.
 * This helps the AI understand the field regardless of the question language.
 * PREVENTS [object Object] errors by strictly checking types.
 */
const getRosettaText = (val: LocalizedText | string | undefined): string => {
  if (val === undefined || val === null) return '';
  
  // If it's already a string, clean it
  if (typeof val === 'string') return val.trim();
  
  // If it's a LocalizedText object
  if (typeof val === 'object') {
      const tr = val.tr?.trim() || '';
      const en = val.en?.trim() || '';

      if (tr && en && tr !== en) return `${tr} (${en})`;
      if (tr) return tr;
      if (en) return en;
      // Fallback if specific keys are missing but object exists
      return JSON.stringify(val);
  }
  
  return String(val);
};

// Recursively checks if an ID exists in the tree
export const checkIdExists = (root: HotelNode, id: string): boolean => {
  if (String(root.id) === String(id)) return true;
  if (root.children) {
    for (let child of root.children) {
      if (checkIdExists(child, id)) return true;
    }
  }
  return false;
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
            return ['menu_item']; 
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

  let newParent: HotelNode | null = null;
  if (position === 'inside') {
      newParent = findNodeById(root, targetId);
  } else {
      const path = findPathToNode(root, targetId);
      if (path && path.length > 1) {
          newParent = path[path.length - 2];
      }
  }

  if (newParent) {
      const allowedTypes = getAllowedTypes(String(newParent.type));
      if (!allowedTypes.includes(String(sourceNode.type)) && allowedTypes.length > 0) {
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
  name: { tr: "Yeni Otel", en: "New Hotel" },
  attributes: [],
  children: [
    {
      id: "gen-info",
      type: "category",
      name: { tr: "Genel Bilgiler", en: "General Info" },
      intent: "informational",
      children: [
        {
          id: "g1",
          type: "field",
          name: { tr: "Otel Adı", en: "Hotel Name" },
          value: { tr: "Grand React Hotel", en: "Grand React Hotel" },
          intent: "informational",
          attributes: [
            { id: 'attr-1', key: { tr: 'Yıldız', en: 'Star' }, value: { tr: '5', en: '5' }, type: 'number' }
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
  delete newNode.data;
  delete newNode.description;
  if (newNode.attributes) {
      newNode.attributes = newNode.attributes.map(attr => ({ ...attr, value: { tr: '', en: '' } }));
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
  aiReadabilityScore: number; // New metric for Data Blindness Prevention
}

export const analyzeHotelStats = (root: HotelNode): HotelStats => {
  let stats: HotelStats = {
    totalNodes: 0,
    categories: 0,
    fillableItems: 0,
    emptyItems: 0,
    completionRate: 0,
    depth: 0,
    aiReadabilityScore: 0
  };

  let totalAiScore = 0;
  let scoredNodesCount = 0;

  const traverse = (node: HotelNode, currentDepth: number) => {
    stats.totalNodes++;
    stats.depth = Math.max(stats.depth, currentDepth);
    const type = String(node.type);
    
    // AI Score Aggregation
    if (node.aiConfidence !== undefined) {
        totalAiScore += node.aiConfidence;
        scoredNodesCount++;
    } else {
        // Default heuristics for non-scored nodes
        // If it has good content, give it a base score
        if (node.name && node.value) {
            totalAiScore += 50; 
            scoredNodesCount++;
        }
    }

    if (type === 'category' || type === 'root' || type === 'menu' || type === 'list') {
      stats.categories++;
    } else {
      stats.fillableItems++;
      let isEmpty = false;
      const valStr = getLocalizedValue(node.value, 'tr');
      const ansStr = getLocalizedValue(node.answer, 'tr');

      if (type === 'qa_pair') {
         if (!ansStr || !ansStr.trim()) isEmpty = true;
      } else if (type === 'menu_item') {
         if (!node.price) isEmpty = true;
      } else {
         if ((!valStr || !valStr.trim()) && !node.data) isEmpty = true;
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
  
  // Calculate AI Score average
  stats.aiReadabilityScore = scoredNodesCount > 0 ? Math.round(totalAiScore / scoredNodesCount) : 0;
  
  return stats;
};

export const filterHotelTree = (node: HotelNode, query: string): HotelNode | null => {
  if (!query) return node;

  const lowerQuery = query.toLowerCase();
  
  const getSearchable = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.toLowerCase();
    if (typeof val === 'object') {
         return `${val.tr || ''} ${val.en || ''}`.toLowerCase();
    }
    return '';
  };
  
  const matchesName = getSearchable(node.name).includes(lowerQuery);
  const matchesValue = getSearchable(node.value).includes(lowerQuery);
  const matchesAnswer = getSearchable(node.answer).includes(lowerQuery);
  const matchesDesc = getSearchable(node.description).includes(lowerQuery);
  const matchesQuestion = (node.question || '').toLowerCase().includes(lowerQuery);

  const matchesIntent = (node.intent || '').toLowerCase().includes(lowerQuery);
  const matchesTags = node.tags?.some(tag => (tag || '').toLowerCase().includes(lowerQuery));
  
  const matchesAttributes = node.attributes?.some(attr => 
    getSearchable(attr.key).includes(lowerQuery) ||
    getSearchable(attr.value).includes(lowerQuery)
  );
  
  let matchesData = false;
  if (node.data) {
      try {
          const dataStr = JSON.stringify(node.data).toLowerCase();
          matchesData = dataStr.includes(lowerQuery);
      } catch (e) { /* ignore JSON error */ }
  }
  
  const isMatch = matchesName || matchesValue || matchesAnswer || matchesDesc || 
                  matchesQuestion || matchesIntent || matchesTags || 
                  matchesAttributes || matchesData;

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

// --- AI TEXT GENERATION (UPDATED FOR DATA BLINDNESS PREVENTION) ---
// This function structures the text so the LLM can associate attributes strictly with their parent.

export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  
  const lines: string[] = [];
  let processedCount = 0;
  
  // 1. First Pass: Count total nodes to manage progress bar accurately
  const countNodes = (node: HotelNode): number => {
      let count = 1;
      if (node.children) {
          count += node.children.reduce((acc, child) => acc + countNodes(child), 0);
      }
      return count;
  };
  const totalNodes = countNodes(root);

  // 2. Recursive Traversal Function
  const processNode = async (node: HotelNode, depth: number, parentPath: string) => {
      processedCount++;
      // Yield every 50 items to keep UI responsive without freezing, but NO LIMIT on total count.
      if (processedCount % 50 === 0) {
          onProgress(Math.round((processedCount / totalNodes) * 100));
          await new Promise(resolve => setTimeout(resolve, 1)); 
      }

      const indent = "  ".repeat(depth);
      
      // Use getRosettaText to safely handle LocalizedText objects
      const name = getRosettaText(node.name);
      
      // Update Path: Root > Category > Item
      const currentPath = parentPath ? `${parentPath} > ${name}` : name;
      
      // Determine Header Level or Bullet
      let prefix = "- ";
      if (depth === 0) prefix = "# ";
      else if (depth === 1) prefix = "## ";
      else if (depth === 2) prefix = "### ";
      
      // Force bullet for deeper levels or specific item types to keep Markdown clean
      if (depth > 2 || ['item', 'field', 'menu_item', 'qa_pair'].includes(String(node.type))) {
          prefix = "- ";
      }

      // LINE 1: Title & Metadata & Unique ID (Critical for AI referencing)
      const intentTag = node.intent ? `[INTENT: ${node.intent.toUpperCase()}]` : '';
      const typeTag = `[TYPE: ${String(node.type).toUpperCase()}]`;
      const idTag = `[ID: ${node.id}]`; // Add ID to context
      
      lines.push(`${indent}${prefix}${name} ${intentTag} ${typeTag} ${idTag}`);

      // LINE 2: Content / Value / Answer
      const value = getRosettaText(node.value || node.answer);
      if (value) {
          lines.push(`${indent}  * Content: ${value}`);
      }

      // LINE 3: Question (for QA pairs)
      if (node.question) {
          lines.push(`${indent}  * Question: ${node.question}`);
      }

      // LINE 4: Price
      if (node.price) {
          lines.push(`${indent}  * Price: ${node.price}`);
      }

      // LINE 5: Attributes (UPDATED FOR DATA BLINDNESS PREVENTION)
      // We format attributes with a specific 'Feature' tag so the AI treats them as first-class citizens of the object.
      if (node.attributes && node.attributes.length > 0) {
          node.attributes.forEach(attr => {
              const k = getRosettaText(attr.key);
              const v = getRosettaText(attr.value);
              if (k && v) {
                  // Using '+' bullet to distinguish attributes from general content
                  lines.push(`${indent}  + [Feature] ${k}: ${v}`);
              }
          });
      }

      // LINE 6: AI Hidden Note
      const desc = getRosettaText(node.description);
      if (desc) {
          lines.push(`${indent}  * AI_Note: ${desc}`);
      }

      // LINE 7: Structured Data (Legacy support)
      if (node.data) {
          try {
             const dataStr = JSON.stringify(node.data);
             if (dataStr.length > 4) lines.push(`${indent}  * MetaData: ${dataStr}`);
          } catch(e) {}
      }

      // RECURSION: Process Children
      if (node.children && node.children.length > 0) {
          // Add a small header if it's an item having children (e.g. "Contains:")
          if (['item', 'room'].includes(String(node.type))) {
              lines.push(`${indent}  * Includes / Contains:`);
          }
          
          for (const child of node.children) {
              // Increase depth for children
              await processNode(child, depth + 1, currentPath);
          }
      }
  };

  // Start Recursion
  await processNode(root, 0, "");
  
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
  if (node.intent) semanticData.intent = node.intent; 
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

  const currentPath = parentPath ? `${parentPath} > ${getLocalizedValue(node.name, 'en') || 'Untitled'}` : (getLocalizedValue(node.name, 'en') || 'Untitled');
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
      const currentPath = [...path, getLocalizedValue(node.name, 'tr') || 'İsimsiz'];
      result.push({ node, path: currentPath });
      if (node.children) node.children.forEach(child => traverse(child, currentPath));
    };
    traverse(root, []);
    return result;
  };

  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const headers = ['Sistem_ID', 'Yol', 'Tip', 'Intent', 'Şema', 'İsim_TR', 'İsim_EN', 'Değer_TR', 'Değer_EN', 'Özellikler', 'Yapısal_Veri'];
  const rows: string[] = ['\uFEFF' + headers.join(',')]; 

  const safeCSV = (val: any) => {
    const s = String(val || '').replace(/"/g, '""');
    return `"${s}"`;
  };

  for (let i = 0; i < totalNodes; i++) {
     const { node, path } = flatNodes[i];
     const nameObj = ensureLocalized(node.name);
     const valueObj = ensureLocalized(node.value || node.answer);

     const attributesStr = JSON.stringify(node.attributes || []);

     rows.push([
        safeCSV(node.id),
        safeCSV(path.join(' > ')),
        safeCSV(node.type),
        safeCSV(node.intent || 'informational'),
        safeCSV(node.schemaType || 'generic'),
        safeCSV(nameObj.tr),
        safeCSV(nameObj.en),
        safeCSV(valueObj.tr),
        safeCSV(valueObj.en),
        safeCSV(attributesStr),
        safeCSV(node.data ? JSON.stringify(node.data) : '')
     ].join(','));
     
     if (i % 50 === 0) {
       onProgress(Math.round((i / totalNodes) * 100));
       await new Promise(r => setTimeout(r, 5));
     }
  }
  return rows.join('\n');
};

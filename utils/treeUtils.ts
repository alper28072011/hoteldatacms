
import { HotelNode, EventData, DiningData, RoomData, NodeType, LocalizedText, NodeAttribute, ExportConfig, ScheduleData, TimeRange, FieldType, LocalizedOptions } from "../types";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
 * EXPORT HELPER: Gets value based on config
 * If single language: Returns string
 * If multi language: Returns object { tr: "...", en: "..." }
 */
const getExportValue = (val: LocalizedText | string | undefined, config: ExportConfig): string | object => {
    const localized = ensureLocalized(val);
    
    if (config.languages.length === 1) {
        return localized[config.languages[0]];
    }
    
    const result: any = {};
    if (config.languages.includes('tr')) result.tr = localized.tr;
    if (config.languages.includes('en')) result.en = localized.en;
    return result;
}

/**
 * EXPORT HELPER: Gets tags based on config
 */
const getExportTags = (val: any | string[] | undefined, config: ExportConfig): string[] | object => {
    if (!val) return [];
    // Legacy support: assume string[] is TR/Global. If object, it's LocalizedOptions
    const localized = Array.isArray(val) ? { tr: val, en: [] } : val;

    if (config.languages.length === 1) {
        return localized[config.languages[0]] || [];
    }

    const result: any = {};
    if (config.languages.includes('tr')) result.tr = localized.tr || [];
    if (config.languages.includes('en')) result.en = localized.en || [];
    return result;
}

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

// --- DUPLICATE NODE LOGIC ---
export const duplicateNodeInTree = (root: HotelNode, nodeIdToCopy: string): HotelNode => {
  // Check if direct child matches
  if (root.children) {
    const index = root.children.findIndex(c => String(c.id) === String(nodeIdToCopy));
    
    if (index !== -1) {
      const original = root.children[index];
      // Create Deep Copy
      const clone = deepClone(original);
      
      // Update Metadata
      clone.id = `${original.id}-copy`;
      
      // Ensure ID Uniqueness in immediate siblings
      let counter = 1;
      while (root.children.some(c => c.id === clone.id)) {
          clone.id = `${original.id}-copy-${counter}`;
          counter++;
      }

      // Update Name
      if (typeof clone.name === 'object') {
          clone.name = {
              tr: `${clone.name.tr} - Kopya`,
              en: `${clone.name.en} - Copy`,
              ...clone.name // preserve other langs if any, but overwrite tr/en
          };
      } else {
          clone.name = `${clone.name} - Kopya`;
      }

      // Update Timestamps & Clean AI Score
      clone.lastModified = Date.now();
      delete clone.aiConfidence;
      
      // Insert at the END of the list (En alta)
      const newChildren = [...root.children, clone];
      return { ...root, children: newChildren };
    }

    // Recursive Search
    let hasChanges = false;
    const newChildren = root.children.map(child => {
        const updatedChild = duplicateNodeInTree(child, nodeIdToCopy);
        if (updatedChild !== child) {
            hasChanges = true;
            return updatedChild;
        }
        return child;
    });

    if (hasChanges) {
        return { ...root, children: newChildren };
    }
  }

  return root;
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
      // Clean sub-attributes too if they exist
      newNode.attributes = newNode.attributes.map(attr => ({
          ...attr,
          value: { tr: '', en: '' },
          subAttributes: attr.subAttributes ? attr.subAttributes.map(sa => ({ ...sa, value: { tr: '', en: '' } })) : undefined
      }));
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
  
  let matchesTags = false;
  if (node.tags) {
      if (Array.isArray(node.tags)) {
          matchesTags = node.tags.some(tag => (tag || '').toLowerCase().includes(lowerQuery));
      } else {
          matchesTags = (node.tags.tr?.some(tag => (tag || '').toLowerCase().includes(lowerQuery)) || 
                         node.tags.en?.some(tag => (tag || '').toLowerCase().includes(lowerQuery))) ?? false;
      }
  }
  
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

// --- EXPORT FUNCTION: JSON ---
// Creates a clean, token-efficient, and AI-friendly JSON structure
export const generateCleanAIJSON = (
    node: HotelNode, 
    config: ExportConfig = { format: 'json', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): any => {
  const semanticData: any = {};
  
  if (node.id) semanticData.id = node.id;
  if (node.type) semanticData.type = node.type;
  if (node.intent) semanticData.intent = node.intent;
  
  // Localized Fields
  if (node.name) semanticData.name = getExportValue(node.name, config);
  if (node.value) semanticData.value = getExportValue(node.value, config);
  if (node.answer) semanticData.answer = getExportValue(node.answer, config); // For Q&A
  if (node.question) semanticData.question = node.question; // Questions are usually static or bilingual string already
  if (node.price) semanticData.price = node.price;

  // AI Context (Only if enabled)
  if (config.options?.descriptions && node.description) {
      semanticData.ai_context = getExportValue(node.description, config);
  }
  
  if (config.options?.tags && node.tags) {
      const tags = getExportTags(node.tags, config);
      // Check if not empty
      const hasTags = Array.isArray(tags) ? tags.length > 0 : (Object.keys(tags).length > 0);
      if (hasTags) semanticData.tags = tags;
  }

  // Attributes (Flattened for better token usage)
  if (node.attributes && Array.isArray(node.attributes) && node.attributes.length > 0) {
      semanticData.attributes = node.attributes.map(a => {
          const attrObj: any = { 
              key: getExportValue(a.key, config), 
              value: getExportValue(a.value, config) 
          };
          
          if (config.options?.descriptions && a.subAttributes && a.subAttributes.length > 0) {
              attrObj.details = a.subAttributes.map(sa => ({
                  key: getExportValue(sa.key, config),
                  value: getExportValue(sa.value, config)
              }));
          }
          return attrObj;
      });
  }

  // Children Recursion
  if (node.children && node.children.length > 0) {
    semanticData.items = node.children.map((child: HotelNode) => generateCleanAIJSON(child, config));
  }

  return semanticData;
};

// --- EXPORT FUNCTION: MINIFIED AI CONTEXT ---
// Extremely compact JSON for minimal token usage while preserving context
export const generateMinifiedAIContext = (
    node: HotelNode,
    config: ExportConfig = { format: 'ai_minified', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): any => {
    const minified: any = {};

    // 1. Essential Identity (Short Keys)
    // n: name, t: type, i: intent
    const nameVal = getExportValue(node.name, config);
    if (nameVal) minified.n = nameVal;
    
    // Type is crucial for context (is it a menu or an item?)
    if (node.type) minified.t = node.type;
    
    // Intent is optional but helpful for AI (is it a rule or info?)
    if (node.intent && node.intent !== 'informational') minified.i = node.intent;

    // 2. Content (Short Keys)
    // v: value/answer, p: price
    const val = getExportValue(node.value || node.answer, config);
    if (val) minified.v = val;
    
    if (node.price) minified.p = node.price;

    // 3. Attributes (Compact Map)
    // a: attributes { "Key": "Value" }
    if (node.attributes && node.attributes.length > 0) {
        const attrs: Record<string, any> = {};
        node.attributes.forEach(attr => {
            const k = getExportValue(attr.key, config);
            const v = getExportValue(attr.value, config);
            
            // Only add if both key and value exist
            if (k && v) {
                // If complex object (multi-lang), stringify key to use as object key
                const keyStr = typeof k === 'string' ? k : JSON.stringify(k);
                attrs[keyStr] = v;
            }
        });
        if (Object.keys(attrs).length > 0) minified.a = attrs;
    }

    // 4. Context & Metadata (Optional)
    // d: description (AI Context), tg: tags
    if (config.options.descriptions && node.description) {
        const desc = getExportValue(node.description, config);
        if (desc) minified.d = desc;
    }

    if (config.options.tags && node.tags) {
        const tags = getExportTags(node.tags, config);
        // Only add if not empty
        const hasTags = Array.isArray(tags) ? tags.length > 0 : (Object.keys(tags).length > 0);
        if (hasTags) minified.tg = tags;
    }

    // 5. Hierarchy (Short Key)
    // c: children
    if (node.children && node.children.length > 0) {
        const kids = node.children
            .map(child => generateMinifiedAIContext(child, config))
            .filter(childObj => Object.keys(childObj).length > 0); // Remove empty nodes
            
        if (kids.length > 0) minified.c = kids;
    }

    return minified;
};

// --- EXPORT FUNCTION: MINIFIED AI TEXT ---
// Compact Markdown/Text for minimal token usage
export const generateMinifiedAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void,
  config: ExportConfig = { format: 'txt_minified', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): Promise<string> => {
  
  const lines: string[] = [];
  let processedCount = 0;
  
  const countNodes = (node: HotelNode): number => {
      let count = 1;
      if (node.children) count += node.children.reduce((acc, child) => acc + countNodes(child), 0);
      return count;
  };
  const totalNodes = countNodes(root);

  const processNode = async (node: HotelNode, depth: number) => {
      processedCount++;
      if (processedCount % 50 === 0) {
          onProgress(Math.round((processedCount / totalNodes) * 100));
          await new Promise(resolve => setTimeout(resolve, 1)); 
      }

      // 1. Compact Indentation (using dashes for hierarchy instead of spaces)
      const prefix = "-".repeat(depth + 1) + " ";

      // 2. Name & Value Combined
      const nameVal = getExportValue(node.name, config);
      const nameStr = typeof nameVal === 'string' ? nameVal : JSON.stringify(nameVal);
      
      let lineContent = `${prefix}${nameStr}`;

      // Value / Answer
      const val = getExportValue(node.value || node.answer, config);
      if (val) {
          const valStr = typeof val === 'string' ? val : JSON.stringify(val);
          // If value is short, append to line with separator. If long, maybe new line? 
          // For minified, let's try to keep it inline or minimal break.
          // Using pipe separator for compactness
          lineContent += ` | ${valStr}`;
      }

      if (node.price) lineContent += ` (${node.price})`;

      // 3. Metadata (Short Codes)
      // i:intent, t:type
      const meta: string[] = [];
      if (node.intent && node.intent !== 'informational') meta.push(`i:${node.intent.substring(0,3)}`);
      // Only show type if it's structural (category, list, menu) to save tokens on items
      if (['category', 'list', 'menu', 'root'].includes(String(node.type))) meta.push(`t:${String(node.type).substring(0,3)}`);
      
      if (meta.length > 0) lineContent += ` [${meta.join(',')}]`;

      // 4. Attributes (Inline Object-like syntax)
      if (node.attributes && node.attributes.length > 0) {
          const attrs = node.attributes
              .map(a => {
                  const k = getExportValue(a.key, config);
                  const v = getExportValue(a.value, config);
                  if (!k || !v) return null;
                  const kStr = typeof k === 'string' ? k : JSON.stringify(k);
                  const vStr = typeof v === 'string' ? v : JSON.stringify(v);
                  return `${kStr}:${vStr}`;
              })
              .filter(Boolean)
              .join(', ');
          
          if (attrs) lineContent += ` {${attrs}}`;
      }

      // 5. Context & Tags (Optional, minimal syntax)
      if (config.options?.descriptions && node.description) {
          const desc = getExportValue(node.description, config);
          const descStr = typeof desc === 'string' ? desc : JSON.stringify(desc);
          // Use a distinct marker for description, e.g. ">>"
          lineContent += ` >> ${descStr}`;
      }

      if (config.options?.tags && node.tags) {
          const tags = getExportTags(node.tags, config);
          let tagStr = '';
          if (Array.isArray(tags)) {
              if (tags.length > 0) tagStr = tags.join(',');
          } else {
              // Object
              const t = tags as any;
              const parts = [];
              if (t.tr && t.tr.length > 0) parts.push(`TR:[${t.tr.join(',')}]`);
              if (t.en && t.en.length > 0) parts.push(`EN:[${t.en.join(',')}]`);
              tagStr = parts.join(' ');
          }
          
          if (tagStr) lineContent += ` #${tagStr}`;
      }

      lines.push(lineContent);

      if (node.children) {
          for (const child of node.children) {
              await processNode(child, depth + 1);
          }
      }
  };

  await processNode(root, 0);
  return lines.join('\n');
};

// --- EXPORT FUNCTION: MARKDOWN / TXT ---

const translateScheduleToNaturalLanguage = (jsonStr: string, lang: 'tr' | 'en'): string => {
    try {
        const data: ScheduleData = JSON.parse(jsonStr);
        const { recurrence, daysOfWeek, startDate, startTime, endTime, sessions, timeRanges } = data;
        
        // Helper to format time ranges
        const formatTimeRanges = (ranges: TimeRange[] | undefined, singleStart: string, singleEnd?: string) => {
             if (ranges && ranges.length > 0) {
                 return ranges.map(r => r.endTime ? `${r.startTime}-${r.endTime}` : r.startTime).join(' ve ');
             }
             return singleEnd ? `${singleStart}-${singleEnd}` : singleStart;
        };

        const timeString = formatTimeRanges(timeRanges, startTime, endTime);

        if (lang === 'tr') {
            if (recurrence === 'complex' && sessions && sessions.length > 0) {
                const sessionParts = sessions.map(s => {
                    const tRange = s.endTime ? `${s.startTime} - ${s.endTime}` : s.startTime;
                    return `${s.day} günleri saat ${tRange}`;
                });
                return `Etkinlik Programı: ${sessionParts.join(', ')}.`;
            }
            if (recurrence === 'daily') return `Her gün saat ${timeString} arasında.`;
            if (recurrence === 'weekly') return `Her hafta ${daysOfWeek?.join(', ')} günleri saat ${timeString} arasında.`;
            if (recurrence === 'biweekly') return `İki haftada bir ${daysOfWeek?.join(', ')} günleri saat ${timeString} arasında.`;
            if (recurrence === 'once') return `${startDate} tarihinde saat ${timeString} (Tek seferlik).`;
        } else {
            const map: any = { 'Pzt': 'Mon', 'Sal': 'Tue', 'Çar': 'Wed', 'Per': 'Thu', 'Cum': 'Fri', 'Cmt': 'Sat', 'Paz': 'Sun' };
            
            if (recurrence === 'complex' && sessions && sessions.length > 0) {
                const sessionParts = sessions.map(s => {
                    const tRange = s.endTime ? `${s.startTime} - ${s.endTime}` : s.startTime;
                    const enDay = map[s.day] || s.day;
                    return `on ${enDay} at ${tRange}`;
                });
                return `Event Schedule: ${sessionParts.join(', ')}.`;
            }

            const enDays = daysOfWeek?.map(d => map[d] || d);
            
            // English time range joiner should be 'and'
            const formatTimeRangesEn = (ranges: TimeRange[] | undefined, singleStart: string, singleEnd?: string) => {
                 if (ranges && ranges.length > 0) {
                     return ranges.map(r => r.endTime ? `${r.startTime}-${r.endTime}` : r.startTime).join(' and ');
                 }
                 return singleEnd ? `${singleStart}-${singleEnd}` : singleStart;
            };
            const timeStringEn = formatTimeRangesEn(timeRanges, startTime, endTime);

            if (recurrence === 'daily') return `Every day between ${timeStringEn}.`;
            if (recurrence === 'weekly') return `Every week on ${enDays?.join(', ')} at ${timeStringEn}.`;
            if (recurrence === 'biweekly') return `Every two weeks on ${enDays?.join(', ')} at ${timeStringEn}.`;
            if (recurrence === 'once') return `On ${startDate} at ${timeStringEn} (One-time).`;
        }
        return jsonStr;
    } catch (e) {
        return jsonStr;
    }
};

export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void,
  config: ExportConfig = { format: 'txt', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): Promise<string> => {
  
  const lines: string[] = [];
  let processedCount = 0;
  
  const countNodes = (node: HotelNode): number => {
      let count = 1;
      if (node.children) count += node.children.reduce((acc, child) => acc + countNodes(child), 0);
      return count;
  };
  const totalNodes = countNodes(root);

  // Helper to format localized output for text
  const formatTextLine = (label: string, val: LocalizedText | string | undefined, type?: FieldType): string => {
      const v = getExportValue(val, config);
      if (!v) return '';
      
      // SPECIAL HANDLING FOR SCHEDULE
      if (type === 'schedule') {
          const parts: string[] = [];
          if (config.languages.includes('tr')) {
             const trVal = typeof val === 'object' ? val.tr : (val as string);
             parts.push(`[TR] ${translateScheduleToNaturalLanguage(trVal, 'tr')}`);
          }
          if (config.languages.includes('en')) {
             const enVal = typeof val === 'object' ? val.en : (val as string);
             parts.push(`[EN] ${translateScheduleToNaturalLanguage(enVal, 'en')}`);
          }
          if (parts.length > 0) return `${label}: ${parts.join(' / ')}`;
      }

      if (typeof v === 'string') return `${label}: ${v}`;
      // If object (multi-lang)
      const parts: string[] = [];
      if ((v as any).tr) parts.push(`[TR] ${(v as any).tr}`);
      if ((v as any).en) parts.push(`[EN] ${(v as any).en}`);
      return `${label}: ${parts.join(' / ')}`;
  };

  const processNode = async (node: HotelNode, depth: number) => {
      processedCount++;
      if (processedCount % 50 === 0) {
          onProgress(Math.round((processedCount / totalNodes) * 100));
          await new Promise(resolve => setTimeout(resolve, 1)); 
      }

      const indent = "  ".repeat(depth);
      let prefix = "- ";
      if (depth === 0) prefix = "# ";
      else if (depth === 1) prefix = "## ";
      else if (depth === 2) prefix = "### ";
      
      if (depth > 2 || ['item', 'field', 'menu_item', 'qa_pair'].includes(String(node.type))) {
          prefix = "- ";
      }

      // Name & Metadata
      const nameStr = typeof getExportValue(node.name, config) === 'string' 
          ? getExportValue(node.name, config) 
          : JSON.stringify(getExportValue(node.name, config));
          
      const intentTag = node.intent ? `[INTENT: ${node.intent}]` : '';
      const typeTag = `[TYPE: ${node.type}]`;
      const idTag = `[ID: ${node.id}]`;
      
      lines.push(`${indent}${prefix}${nameStr} ${intentTag} ${typeTag} ${idTag}`);

      // Values
      const contentLine = formatTextLine("Content", node.value || node.answer);
      if (contentLine) lines.push(`${indent}  ${contentLine}`);

      if (node.price) lines.push(`${indent}  Price: ${node.price}`);

      // Attributes
      if (node.attributes && node.attributes.length > 0) {
          node.attributes.forEach(attr => {
              // Only process attributes, simpler than the display function
              const k = typeof getExportValue(attr.key, config) === 'string' ? getExportValue(attr.key, config) : JSON.stringify(getExportValue(attr.key, config));
              
              // Use formatTextLine logic for value to handle schedule
              const vLine = formatTextLine("Value", attr.value, attr.type);
              // Extract just the value part from "Value: ..."
              const v = vLine.replace(/^Value: /, '');
              
              if (k && v) {
                  lines.push(`${indent}  + [Feat] ${k}: ${v}`);
                  // Sub-attributes
                  if (config.options?.descriptions && attr.subAttributes) {
                      attr.subAttributes.forEach(sa => {
                          const sk = typeof getExportValue(sa.key, config) === 'string' ? getExportValue(sa.key, config) : JSON.stringify(getExportValue(sa.key, config));
                          const svLine = formatTextLine("Value", sa.value, sa.type);
                          const sv = svLine.replace(/^Value: /, '');
                          
                          if (sk && sv) lines.push(`${indent}    > ${sk}: ${sv}`);
                      });
                  }
              }
          });
      }

      // Tags / Keywords (NEW: AI Semantic Indexing)
      if (config.options?.tags && node.tags) {
          const tags = Array.isArray(node.tags) 
              ? node.tags 
              : [...(node.tags.tr || []), ...(node.tags.en || [])];
          
          if (tags.length > 0) {
              const uniqueTags = Array.from(new Set(tags));
              lines.push(`${indent}  * Keywords: ${uniqueTags.map(t => `#${t}`).join(', ')}`);
          }
      }

      // AI Context (System Note)
      if (config.options?.descriptions && node.description) {
          const descLine = formatTextLine("SYSTEM_NOTE", node.description);
          if (descLine) lines.push(`${indent}  ${descLine}`);
      }

      if (node.children) {
          for (const child of node.children) {
              await processNode(child, depth + 1);
          }
      }
  };

  await processNode(root, 0);
  return lines.join('\n');
};

// --- EXPORT FUNCTION: CSV ---
export const generateOptimizedCSV = async (
    root: HotelNode, 
    onProgress: (percent: number) => void,
    config: ExportConfig = { format: 'csv', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): Promise<string> => {
  const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[] }[] => {
    const result: { node: HotelNode, path: string[] }[] = [];
    const traverse = (node: HotelNode, path: string[]) => {
      // Path usually follows English structure for consistency, or primary lang
      const pathName = getLocalizedValue(node.name, config.languages[0] || 'en');
      const currentPath = [...path, pathName];
      result.push({ node, path: currentPath });
      if (node.children) node.children.forEach(child => traverse(child, currentPath));
    };
    traverse(root, []);
    return result;
  };

  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  // Dynamic Headers based on Config
  const headers = ['ID', 'Path', 'Type', 'Intent'];
  
  if (config.languages.includes('tr')) headers.push('Name_TR', 'Value_TR');
  if (config.languages.includes('en')) headers.push('Name_EN', 'Value_EN');
  
  headers.push('Attributes_JSON'); // Attributes always complex, keep as JSON but localized
  
  if (config.options?.descriptions) {
      if (config.languages.includes('tr')) headers.push('AI_Desc_TR');
      if (config.languages.includes('en')) headers.push('AI_Desc_EN');
  }
  
  if (config.options?.tags) {
      headers.push('Keywords'); // Add Keywords column
  }

  const rows: string[] = ['\uFEFF' + headers.join(',')]; 

  const safeCSV = (val: any) => {
    const s = String(val || '').replace(/"/g, '""'); // Escape double quotes
    return `"${s}"`;
  };

  for (let i = 0; i < totalNodes; i++) {
     const { node, path } = flatNodes[i];
     const nameObj = ensureLocalized(node.name);
     const valueObj = ensureLocalized(node.value || node.answer);
     const descObj = ensureLocalized(node.description);

     const rowData: string[] = [
        safeCSV(node.id),
        safeCSV(path.join(' > ')),
        safeCSV(node.type),
        safeCSV(node.intent || 'informational')
     ];

     if (config.languages.includes('tr')) {
         rowData.push(safeCSV(nameObj.tr));
         rowData.push(safeCSV(valueObj.tr));
     }
     if (config.languages.includes('en')) {
         rowData.push(safeCSV(nameObj.en));
         rowData.push(safeCSV(valueObj.en));
     }

     // Attributes: Process according to language config
     const processedAttributes = node.attributes?.map(a => ({
         key: getExportValue(a.key, config),
         value: getExportValue(a.value, config)
     })) || [];
     rowData.push(safeCSV(JSON.stringify(processedAttributes)));

     if (config.options?.descriptions) {
         if (config.languages.includes('tr')) rowData.push(safeCSV(descObj.tr));
         if (config.languages.includes('en')) rowData.push(safeCSV(descObj.en));
     }
     
     if (config.options?.tags) {
         const tags = Array.isArray(node.tags) 
             ? node.tags 
             : [...(node.tags?.tr || []), ...(node.tags?.en || [])];
         const uniqueTags = Array.from(new Set(tags));
         rowData.push(safeCSV(uniqueTags.join(', ')));
     }

     rows.push(rowData.join(','));
     
     if (i % 50 === 0) {
       onProgress(Math.round((i / totalNodes) * 100));
       await new Promise(r => setTimeout(r, 5));
     }
  }
  return rows.join('\n');
};

// --- EXPORT FUNCTION: PDF ---
export const generatePDF = (
    root: HotelNode,
    config: ExportConfig = { format: 'pdf', languages: ['tr', 'en'], options: { descriptions: true, tags: true } }
): jsPDF => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Hotel Data Export", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateStr}`, 14, 30);

    // Prepare Data
    const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[] }[] => {
        const result: { node: HotelNode, path: string[] }[] = [];
        const traverse = (node: HotelNode, path: string[]) => {
            const pathName = getLocalizedValue(node.name, config.languages[0] || 'en');
            const currentPath = [...path, pathName];
            result.push({ node, path: currentPath });
            if (node.children) node.children.forEach(child => traverse(child, currentPath));
        };
        traverse(root, []);
        return result;
    };

    const flatNodes = flattenTreeForExport(root);
    
    // Define Columns
    const head: string[][] = [['ID', 'Path', 'Type']];
    const body: any[] = [];

    // Dynamic Headers
    if (config.languages.includes('tr')) { head[0].push('Name (TR)', 'Value (TR)'); }
    if (config.languages.includes('en')) { head[0].push('Name (EN)', 'Value (EN)'); }
    
    if (config.options?.descriptions || config.options?.tags) {
        head[0].push('AI Context / Tags');
    }

    // Populate Rows
    flatNodes.forEach(({ node, path }) => {
        const row: string[] = [
            node.id,
            path.join(' > '),
            node.type
        ];

        if (config.languages.includes('tr')) {
            row.push(getLocalizedValue(node.name, 'tr'));
            row.push(getLocalizedValue(node.value || node.answer, 'tr'));
        }
        if (config.languages.includes('en')) {
            row.push(getLocalizedValue(node.name, 'en'));
            row.push(getLocalizedValue(node.value || node.answer, 'en'));
        }

        if (config.options?.descriptions || config.options?.tags) {
            const contextParts: string[] = [];
            if (config.options?.descriptions && node.description) {
                const desc = getExportValue(node.description, config);
                const descStr = typeof desc === 'string' ? desc : JSON.stringify(desc);
                contextParts.push(`Desc: ${descStr.substring(0, 100)}${descStr.length > 100 ? '...' : ''}`);
            }
            if (config.options?.tags && node.tags) {
                const tags = Array.isArray(node.tags) 
                    ? node.tags 
                    : [...(node.tags.tr || []), ...(node.tags.en || [])];
                
                if (tags.length > 0) {
                    const uniqueTags = Array.from(new Set(tags));
                    contextParts.push(`Tags: ${uniqueTags.join(', ')}`);
                }
            }
            
            row.push(contextParts.join('\n'));
        }
        
        body.push(row);
    });

    autoTable(doc, {
        head: head,
        body: body,
        startY: 40,
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [16, 185, 129] }, // Emerald color
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
            0: { cellWidth: 20 }, // ID
            1: { cellWidth: 30 }, // Path
            2: { cellWidth: 20 }, // Type
            // Others auto
        }
    });

    return doc;
};

export const filterHotelData = (node: HotelNode, config: ExportConfig): HotelNode => {
    const newNode = { ...node };
    
    if (!config.options?.descriptions) {
        delete newNode.description;
        // Also remove subAttributes from attributes if they are considered details
        if (newNode.attributes) {
            newNode.attributes = newNode.attributes.map(attr => {
                const newAttr = { ...attr };
                delete newAttr.subAttributes; 
                return newAttr;
            });
        }
    }
    
    if (!config.options?.tags) {
        delete newNode.tags;
    }
    
    if (newNode.children) {
        newNode.children = newNode.children.map(child => filterHotelData(child, config));
    }
    
    return newNode;
};

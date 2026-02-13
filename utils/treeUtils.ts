
import { HotelNode } from "../types";

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
  name: "New Hotel",
  attributes: [],
  children: [
    {
      id: "gen-info",
      type: "category",
      name: "General Information",
      children: [
        {
          id: "g1",
          type: "field",
          name: "Hotel Name",
          value: "Grand React Hotel",
          attributes: [
            { id: 'attr-1', key: 'Stars', value: '5', type: 'number' }
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
  delete newNode.startTime;
  delete newNode.endTime;
  delete newNode.answer;
  delete newNode.calories;
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
         if (!node.value || !node.value.trim()) isEmpty = true;
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
  definitions: Map<string, string>; // Maps "Standard Minibar" -> "Coke, Water, Beer..."
  globalRules: string[];
}

/**
 * Builds a Global Knowledge Graph of definitions.
 * It finds 'list', 'menu', 'policy' nodes and creates a concise summary of their content.
 */
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
        // Extract a summary of this container's children
        const childrenSummary = node.children
          ?.map(c => c.name + (c.value ? `: ${c.value}` : ''))
          .slice(0, 5) // Limit to 5 items to keep definitions concise
          .join(', ');
        
        if (childrenSummary) {
          index.definitions.set(name, childrenSummary);
        }
      }
    }

    // Index Global Rules (Heuristic: tagged 'global' or named 'General Rules')
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

/**
 * SMART WEAVING ALGORITHM (generateAIText)
 * 1. Indexes the tree to understand what "things" are.
 * 2. Generates Markdown where undefined references (like "Standard Minibar") 
 *    are automatically enriched with their definition found elsewhere in the tree.
 */
export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  
  // Phase 1: Build Knowledge Graph
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

  // Phase 2: Enriched Generation
  for (let i = 0; i < totalNodes; i++) {
    const { node, depth } = flatNodes[i];
    const type = String(node.type);
    const name = node.name || 'Untitled';
    const value = node.value || node.answer || '';
    
    // Indentation based on depth
    const indent = "  ".repeat(depth);
    let line = "";

    // A. Structural Formatting
    const isContainer = ['root', 'category', 'list', 'menu'].includes(type);
    
    if (isContainer) {
       // Headers for high level, bullets for deep nested lists
       if (depth < 3) {
         line = `\n${"#".repeat(depth + 1)} ${name}`;
       } else {
         line = `${indent}- **[${type.toUpperCase()}] ${name}**`;
       }
    } else {
       // Items / Fields
       line = `${indent}- ${name}`;
    }

    // B. Value & Definition Injection (Smart Weaving)
    if (value) {
      line += `: ${value}`;
      
      // CHECK FOR DEFINITION LINK
      // If the value matches a key in our Global Index (e.g. value="Standard Minibar"), inject the def.
      // We skip if the node itself is the definition container to avoid self-reference loops.
      const definition = globalIndex.definitions.get(value.trim());
      if (definition && type !== 'list' && type !== 'menu') {
        line += ` _(System Definition: ${definition}...)_`;
      }
    }

    // C. Attribute Injection
    const attributesParts: string[] = [];
    if (node.price) attributesParts.push(`Price: ${node.price}`);
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

    // D. Global Rule Injection for Rooms (Context Awareness)
    // If this node is a Room, inject global amenities automatically
    if (type === 'category' && (name.toLowerCase().includes('room') || name.toLowerCase().includes('suite'))) {
       if (globalIndex.globalRules.length > 0) {
         // Only inject a summary to save tokens
         line += `\n${indent}  > *Implicit Global Amenities applied: ${globalIndex.globalRules.length} items included.*`;
       }
    }

    lines.push(line);

    // E. Note/Q&A Handling (Visual Grouping)
    if (node.description) {
       lines.push(`${indent}  > Note: ${node.description}`);
    }

    // Progress Update
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
  if (node.question) semanticData.question = node.question;
  if (node.answer) semanticData.answer = node.answer;
  if (node.price) semanticData.price = node.price;

  const excludeKeys = new Set([
      'id', 'type', 'name', 'value', 'description', 'tags', 'question', 
      'answer', 'price', 'children', 'attributes', 'uiState', 'lastSaved', 'isExpanded'
  ]);
  
  Object.keys(node).forEach(key => {
     if (!excludeKeys.has(key) && !key.startsWith('_')) {
         const safe = safeCopy(node[key], 0);
         if (safe !== undefined) semanticData[key] = safe;
     }
  });

  const currentPath = parentPath ? `${parentPath} > ${node.name || 'Untitled'}` : (node.name || 'Untitled');
  semanticData._path = currentPath;

  if (node.attributes && Array.isArray(node.attributes) && node.attributes.length > 0) {
    const features: Record<string, string> = {};
    node.attributes.forEach((attr: any) => {
        const safeKey = (attr.key || '').trim();
        if (safeKey) {
            features[safeKey] = attr.value || '';
        }
    });
    
    if (Object.keys(features).length > 0) {
        semanticData.features = features;
    }
  }

  if (node.children && node.children.length > 0) {
    semanticData.contains = node.children.map((child: HotelNode) => generateCleanAIJSON(child, currentPath));
  }

  return semanticData;
};

export const generateOptimizedCSV = async (root: HotelNode, onProgress: (percent: number) => void): Promise<string> => {
  // Simple CSV generation kept for export compatibility
  const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[] }[] => {
    const result: { node: HotelNode, path: string[] }[] = [];
    const traverse = (node: HotelNode, path: string[]) => {
      const currentPath = [...path, node.name || 'Untitled'];
      result.push({ node, path: currentPath });
      if (node.children) node.children.forEach(child => traverse(child, currentPath));
    };
    traverse(root, []);
    return result;
  };

  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const headers = ['System_ID', 'Path', 'Type', 'Name', 'Value', 'Attributes'];
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
        safeCSV(node.name),
        safeCSV(node.value),
        safeCSV(JSON.stringify(node.attributes || []))
     ].join(','));
     
     if (i % 50 === 0) {
       onProgress(Math.round((i / totalNodes) * 100));
       await new Promise(r => setTimeout(r, 5));
     }
  }
  return rows.join('\n');
};

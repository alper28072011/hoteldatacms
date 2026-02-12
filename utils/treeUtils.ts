
import { HotelNode } from "../types";

// Generate a simple unique ID
export const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

/**
 * OPTIMIZED: UPDATE NODE (Structural Sharing)
 */
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

/**
 * OPTIMIZED: ADD CHILD (Structural Sharing)
 */
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

/**
 * OPTIMIZED: DELETE NODE (Structural Sharing)
 */
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

/**
 * NEW: INSERT NODE SIBLING (Before/After)
 * Helper to insert a node adjacent to a target node.
 */
const insertNodeSibling = (root: HotelNode, targetId: string, newNode: HotelNode, position: 'before' | 'after'): HotelNode => {
  if (String(root.id) === String(targetId)) return root; // Cannot insert sibling of root

  if (!root.children) return root;

  // Check if target is a direct child
  const index = root.children.findIndex(c => String(c.id) === String(targetId));
  
  if (index !== -1) {
    const newChildren = [...root.children];
    const insertIndex = position === 'before' ? index : index + 1;
    newChildren.splice(insertIndex, 0, newNode);
    return { ...root, children: newChildren };
  }

  // Recurse
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

/**
 * NEW: MOVE NODE (Drag & Drop Logic)
 */
export const moveNode = (root: HotelNode, sourceId: string, targetId: string, position: 'inside' | 'before' | 'after'): HotelNode => {
  // 1. Basic Validation
  if (sourceId === targetId) return root;
  if (sourceId === 'root') return root; 
  if (targetId === 'root' && position !== 'inside') return root; // Can only insert INSIDE root, not before/after

  // 2. Find Source Node
  const sourceNode = findNodeById(root, sourceId);
  if (!sourceNode) return root;

  // 3. Circular Dependency Check (Cannot move parent inside its own child)
  const targetPath = findPathToNode(root, targetId);
  if (targetPath && targetPath.some(n => n.id === sourceId)) {
    console.warn("Cannot move a node into its own descendant");
    return root;
  }

  // 4. Remove Source from old location
  // We use the existing delete function which returns a new tree reference
  const treeWithoutSource = deleteNodeFromTree(root, sourceId);

  // 5. Insert Source at new location
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

// --- TEMPLATE ALGORITHMS ---

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
  // Attributes should probably be kept in structure mode, but values cleared? 
  // For now, let's keep attributes as they are often structural (e.g. "Is Paid")
  if (newNode.attributes) {
      newNode.attributes = newNode.attributes.map(attr => ({ ...attr, value: '' }));
  }

  if (node.children) {
    newNode.children = node.children.map(child => cleanTreeValues(child));
  }
  return newNode;
};

// --- DATA HEALTH STATISTICS ---

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

// --- SEARCH ALGORITHM ---

export const filterHotelTree = (node: HotelNode, query: string): HotelNode | null => {
  if (!query) return node;

  const lowerQuery = query.toLowerCase();
  
  const nameMatch = node.name?.toLowerCase().includes(lowerQuery);
  const valueMatch = node.value?.toLowerCase().includes(lowerQuery);
  const tagsMatch = node.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
  
  // CRITICAL UPDATE: Search inside Attributes/Properties as well
  const attributesMatch = node.attributes?.some(attr => 
    attr.key.toLowerCase().includes(lowerQuery) || 
    attr.value.toLowerCase().includes(lowerQuery)
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

// --- EXPORT ALGORITHMS ---

const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[], depth: number }[] => {
  const result: { node: HotelNode, path: string[], depth: number }[] = [];
  const traverse = (node: HotelNode, path: string[], depth: number) => {
    const currentPath = [...path, node.name || 'Untitled'];
    result.push({ node, path: currentPath, depth });
    if (node.children) {
      node.children.forEach(child => traverse(child, currentPath, depth + 1));
    }
  };
  traverse(root, [], 0);
  return result;
};

const generateAvailabilityRule = (node: HotelNode): string => {
  const rule: any = {};
  if (node.recurrenceType) rule.recurrence = node.recurrenceType;
  if (node.startTime) rule.start = node.startTime;
  if (node.endTime) rule.end = node.endTime;
  if (node.days && node.days.length > 0) rule.days = node.days;
  if (node.validFrom) rule.validFrom = node.validFrom;
  if (node.validUntil) rule.validUntil = node.validUntil;
  if (node.eventStatus) rule.status = node.eventStatus;
  
  return Object.keys(rule).length > 0 ? JSON.stringify(rule) : '';
};

const generateRichAttributes = (node: HotelNode): string => {
  const parts: string[] = [];
  
  // Legacy
  if (node.price) parts.push(`Price: $${node.price}`);
  if (node.isPaid) parts.push(`isPaid: true`);
  
  // New Attributes
  if (node.attributes) {
      node.attributes.forEach(attr => {
          parts.push(`${attr.key}: ${attr.value}`);
      });
  }
  
  return parts.join(' | ');
};

export const generateOptimizedCSV = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const headers = [
    'System_ID', 
    'Context_Path', 
    'Parent_Context', 
    'Node_Type', 
    'Name', 
    'Primary_Content', 
    'Availability_Rule', 
    'Rich_Attributes', 
    'Tags', 
    'AI_Description'
  ];

  const rows: string[] = [];
  rows.push('\uFEFF' + headers.join(',')); 

  const safeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const stringVal = String(val);
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  };

  const CHUNK_SIZE = 50;
  for (let i = 0; i < totalNodes; i += CHUNK_SIZE) {
    const chunk = flatNodes.slice(i, i + CHUNK_SIZE);
    chunk.forEach(({ node, path }) => {
       const fullPath = path.join(' > ');
       const parentPath = path.slice(0, -1).join(' > ') || 'ROOT';
       
       const content = node.value || node.answer || node.question || '';

       const rowData = [
         safeCSV(node.id),
         safeCSV(fullPath),
         safeCSV(parentPath), 
         safeCSV(node.type),
         safeCSV(node.name),
         safeCSV(content),
         safeCSV(generateAvailabilityRule(node)),
         safeCSV(generateRichAttributes(node)), 
         safeCSV((node.tags || []).join(', ')),
         safeCSV(node.description)
       ];
       rows.push(rowData.join(','));
    });
    const progress = Math.round(((i + chunk.length) / totalNodes) * 100);
    onProgress(progress);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  return rows.join('\n');
};

export const generateCleanAIJSON = (node: HotelNode, parentPath: string = ''): any => {
  const { 
    id, 
    lastSaved, 
    uiState, 
    isExpanded, 
    children,
    ...semanticData 
  } = node as any;

  const currentPath = parentPath ? `${parentPath} > ${node.name || 'Untitled'}` : (node.name || 'Untitled');
  semanticData._path = currentPath;

  // Flatten attributes into the semantic object for AI
  if (node.attributes) {
      node.attributes.forEach((attr: any) => {
          // Robustly handle keys to prevent JSON issues
          const safeKey = attr.key.trim();
          if (safeKey) {
             semanticData[safeKey] = attr.value;
          }
      });
      delete semanticData.attributes; // Remove raw array
  }

  Object.keys(semanticData).forEach(key => {
    if (semanticData[key] === null || semanticData[key] === undefined || semanticData[key] === '') {
      delete semanticData[key];
    }
    if (Array.isArray(semanticData[key]) && semanticData[key].length === 0) {
      delete semanticData[key];
    }
  });

  if (children && children.length > 0) {
    semanticData.contains = children.map((child: HotelNode) => generateCleanAIJSON(child, currentPath));
  }

  return semanticData;
};

export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  const lines: string[] = [];
  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const CHUNK_SIZE = 50;

  for (let i = 0; i < totalNodes; i += CHUNK_SIZE) {
      const chunk = flatNodes.slice(i, i + CHUNK_SIZE);
      
      chunk.forEach(({ node, path }) => {
          const contextPath = `[${path.join(' > ')}]`;
          
          let content = `${contextPath} ${node.type.toUpperCase()}: ${node.name || 'Untitled'}`;

          if (node.value) content += ` | Value: ${node.value}`;
          if (node.question) content += ` | Question: ${node.question}`;
          if (node.answer) content += ` | Answer: ${node.answer}`;

          if (node.attributes) {
              content += " | " + node.attributes.map(a => `${a.key}: ${a.value}`).join(', ');
          }
          
          if (node.tags && node.tags.length > 0) content += ` | Tags: ${node.tags.join(', ')}`;
          if (node.description) content += ` | Note: ${node.description}`;

          lines.push(content);
      });

      const progress = Math.round(((i + chunk.length) / totalNodes) * 100);
      onProgress(progress);
      await new Promise(resolve => setTimeout(resolve, 5));
  }

  return lines.join('\n');
};

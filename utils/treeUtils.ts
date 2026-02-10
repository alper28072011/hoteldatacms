
import { HotelNode } from "../types";

// Generate a simple unique ID
export const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

// Modern, fast deep clone using native browser API
// Note: For state updates, prefer using the immutable functions below instead of cloning the whole tree.
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
    // Standard iterative loop is slightly faster than for...of in V8 for hot paths
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
 * Instead of deep cloning the whole tree, we recursively traverse.
 * We only create new object references for the nodes on the path to the target.
 * Unchanged branches retain their original references.
 */
export const updateNodeInTree = (root: HotelNode, targetId: string, updates: Partial<HotelNode>): HotelNode => {
  // 1. Check if this is the target
  if (String(root.id) === String(targetId)) {
    // Create new reference with updates
    return { ...root, ...updates };
  }

  // 2. If leaf node, return original reference (no changes here)
  if (!root.children) {
    return root;
  }

  // 3. Traverse children
  let hasChanges = false;
  const newChildren = root.children.map(child => {
    const updatedChild = updateNodeInTree(child, targetId, updates);
    
    // Reference check: If child returned a new reference, something changed down there
    if (updatedChild !== child) {
      hasChanges = true;
      return updatedChild;
    }
    return child;
  });

  // 4. If nothing changed in children, return original root reference (Prevents re-renders)
  if (!hasChanges) {
    return root;
  }

  // 5. If something changed, return new root with new children array
  return { ...root, children: newChildren };
};

/**
 * OPTIMIZED: ADD CHILD (Structural Sharing)
 */
export const addChildToNode = (root: HotelNode, parentId: string, newChild: HotelNode): HotelNode => {
  // 1. Found the parent
  if (String(root.id) === String(parentId)) {
    return {
      ...root,
      children: root.children ? [...root.children, newChild] : [newChild]
    };
  }

  // 2. Leaf node check
  if (!root.children) {
    return root;
  }

  // 3. Recursive traversal
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
  // 1. Edge case: Trying to delete root (usually handled by UI, but good for safety)
  if (String(root.id) === String(nodeIdToDelete)) {
    // Depending on logic, might return null or throw. 
    // Here we return root to prevent crash, assuming root deletion is blocked at UI level.
    return root; 
  }

  if (!root.children) return root;

  // 2. Check if direct child needs to be deleted
  const childIndex = root.children.findIndex(c => String(c.id) === String(nodeIdToDelete));
  
  if (childIndex !== -1) {
    // Found it: Remove it and return new node
    const newChildren = [...root.children];
    newChildren.splice(childIndex, 1);
    return { ...root, children: newChildren };
  }

  // 3. Deep traversal
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

export const getInitialData = (): HotelNode => ({
  id: "root",
  type: "root",
  name: "New Hotel",
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
          value: "Grand React Hotel"
        }
      ]
    }
  ]
});

// --- TEMPLATE ALGORITHMS ---

export const regenerateIds = (node: HotelNode): HotelNode => {
  // This operation inherently creates a new tree, so deep mapping is required.
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
  
  const isMatch = nameMatch || valueMatch || tagsMatch;

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

/**
 * Helper to flatten tree for export with full path tracking.
 */
const flattenTreeForExport = (root: HotelNode): { node: HotelNode, path: string[], depth: number }[] => {
  const result: { node: HotelNode, path: string[], depth: number }[] = [];
  const traverse = (node: HotelNode, path: string[], depth: number) => {
    // Current path includes the node name to form the full breadcrumb
    const currentPath = [...path, node.name || 'Untitled'];
    result.push({ node, path: currentPath, depth });
    if (node.children) {
      node.children.forEach(child => traverse(child, currentPath, depth + 1));
    }
  };
  traverse(root, [], 0);
  return result;
};

/**
 * Standardize logic rules into a JSON string for AI parsing.
 */
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

/**
 * Explicitly label attributes for CSV export.
 */
const generateRichAttributes = (node: HotelNode): string => {
  const parts: string[] = [];
  
  if (node.price) parts.push(`Price: $${node.price}`);
  if (node.isPaid) parts.push(`isPaid: true`);
  if (node.calories) parts.push(`Calories: ${node.calories}`);
  if (node.targetAudience) parts.push(`Audience: ${node.targetAudience}`);
  if (node.minAge) parts.push(`MinAge: ${node.minAge}`);
  if (node.maxAge) parts.push(`MaxAge: ${node.maxAge}`);
  if (node.location) parts.push(`Location: ${node.location}`);
  if (node.isMandatory) parts.push('Mandatory: true');
  if (node.requiresReservation) parts.push('Reservation: Required');
  
  return parts.join(' | ');
};

/**
 * GENERATE OPTIMIZED CSV
 * RAG-Ready: Includes full context path and JSON rules.
 */
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
       // Parent path is everything except the last item
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

/**
 * GENERATE CLEAN AI JSON
 * Removes noise (IDs, UI flags) and keeps only semantic structure.
 * Adds _path context to every node so AI doesn't lose hierarchy when chunking.
 */
export const generateCleanAIJSON = (node: HotelNode, parentPath: string = ''): any => {
  // Fields to EXCLUDE to reduce token usage and noise for AI
  const { 
    id, 
    lastSaved, 
    uiState, 
    isExpanded, 
    children,
    ...semanticData 
  } = node as any;

  // Construct current path for context injection
  const currentPath = parentPath ? `${parentPath} > ${node.name || 'Untitled'}` : (node.name || 'Untitled');
  
  // Inject path context
  semanticData._path = currentPath;

  // Clean empty fields
  Object.keys(semanticData).forEach(key => {
    if (semanticData[key] === null || semanticData[key] === undefined || semanticData[key] === '') {
      delete semanticData[key];
    }
    // Remove empty arrays (except children which we handle separately)
    if (Array.isArray(semanticData[key]) && semanticData[key].length === 0) {
      delete semanticData[key];
    }
  });

  // Recursively clean children
  if (children && children.length > 0) {
    semanticData.contains = children.map((child: HotelNode) => generateCleanAIJSON(child, currentPath));
  }

  return semanticData;
};

/**
 * GENERATE AI-OPTIMIZED TEXT (MARKDOWN/TXT)
 * Creates a structured representation where every line is self-contained.
 * Good for vector embeddings that split by newlines.
 */
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
          // Construct Context String: [Hotel > Dining > Menu]
          const contextPath = `[${path.join(' > ')}]`;
          
          let content = `${contextPath} ${node.type.toUpperCase()}: ${node.name || 'Untitled'}`;

          // Primary Value
          if (node.value) content += ` | Value: ${node.value}`;
          if (node.question) content += ` | Question: ${node.question}`;
          if (node.answer) content += ` | Answer: ${node.answer}`;

          // Attributes
          if (node.price) content += ` | Price: $${node.price}`;
          if (node.calories) content += ` | Calories: ${node.calories}`;
          if (node.eventStatus) content += ` | Status: ${node.eventStatus}`;
          
          // Availability Logic
          const availability = generateAvailabilityRule(node);
          if (availability) content += ` | Rules: ${availability}`;
          
          // Tags & Description
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

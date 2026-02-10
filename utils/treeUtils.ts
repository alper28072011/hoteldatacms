
import { HotelNode } from "../types";

// Generate a simple unique ID
export const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

// Deep clone to avoid mutating state directly
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Find a node by ID
export const findNodeById = (root: HotelNode, id: string): HotelNode | null => {
  if (String(root.id) === String(id)) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
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
    for (const child of root.children) {
      const path = findPathToNode(child, targetId);
      if (path) {
        return [root, ...path];
      }
    }
  }
  
  return null;
};

// Find a node and update it
export const updateNodeInTree = (root: HotelNode, targetId: string, updates: Partial<HotelNode>): HotelNode => {
  const newRoot = deepClone(root);
  
  const findAndUpdate = (node: HotelNode): boolean => {
    if (String(node.id) === String(targetId)) {
      Object.assign(node, updates);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (findAndUpdate(child)) return true;
      }
    }
    return false;
  };

  findAndUpdate(newRoot);
  return newRoot;
};

// Find a parent and add a child to it
export const addChildToNode = (root: HotelNode, parentId: string, newChild: HotelNode): HotelNode => {
  const newRoot = deepClone(root);

  const findAndAdd = (node: HotelNode): boolean => {
    if (String(node.id) === String(parentId)) {
      if (!node.children) node.children = [];
      node.children.push(newChild);
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (findAndAdd(child)) return true;
      }
    }
    return false;
  };

  findAndAdd(newRoot);
  return newRoot;
};

// Find parent and remove a specific child - Robust Recursive Implementation
export const deleteNodeFromTree = (root: HotelNode, nodeIdToDelete: string): HotelNode => {
  if (String(root.id) === String(nodeIdToDelete)) {
    return root; 
  }

  const rebuildTree = (node: HotelNode): HotelNode | null => {
    if (String(node.id) === String(nodeIdToDelete)) {
      return null;
    }
    
    if (node.children) {
      const newChildren = node.children
        .map(child => rebuildTree(child))
        .filter((child): child is HotelNode => child !== null);
        
      return { ...node, children: newChildren };
    }
    
    return { ...node };
  };

  const newRoot = rebuildTree(root);
  return newRoot || root; 
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
 * GENERATE OPTIMIZED CSV
 */
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

const generateRichAttributes = (node: HotelNode): string => {
  const parts: string[] = [];
  if (node.price) parts.push(`Price: $${node.price}`);
  if (node.calories) parts.push(`Calories: ${node.calories}kcal`);
  if (node.type === 'event') {
      if (node.startTime && node.endTime) parts.push(`Time: ${node.startTime}-${node.endTime}`);
      if (node.recurrenceType) parts.push(`Recurrence: ${node.recurrenceType}`);
      if (node.days && node.days.length > 0) parts.push(`Days: ${node.days.join('/')}`);
      if (node.targetAudience) parts.push(`Audience: ${node.targetAudience}`);
      if (node.eventStatus) parts.push(`Status: ${node.eventStatus}`);
  }
  if (node.isPaid) parts.push('Requires Payment');
  if (node.isMandatory) parts.push('Mandatory');
  return parts.join(' | ');
};

export const generateOptimizedCSV = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  const flatNodes = flattenTreeForExport(root);
  const totalNodes = flatNodes.length;
  
  const headers = [
    'System_ID', 'Semantic_Path', 'Node_Type', 'Name', 
    'Primary_Content', 'Rich_Attributes', 'Tags', 'AI_Description'
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
       const rowData = [
         safeCSV(node.id),
         safeCSV(path.join(' > ')), 
         safeCSV(node.type),
         safeCSV(node.name),
         safeCSV(node.value || node.answer || node.question), 
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
 */
export const generateCleanAIJSON = (node: HotelNode): any => {
  // Fields to EXCLUDE to reduce token usage and noise for AI
  const { 
    id, 
    lastSaved, 
    uiState, 
    isExpanded, // hypothetical UI state
    children,
    ...semanticData 
  } = node as any;

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
    semanticData.contains = children.map((child: HotelNode) => generateCleanAIJSON(child));
  }

  return semanticData;
};

/**
 * GENERATE AI-OPTIMIZED TEXT (MARKDOWN)
 * Creates a structured, indented textual representation perfect for RAG context windows.
 */
export const generateAIText = async (
  root: HotelNode, 
  onProgress: (percent: number) => void
): Promise<string> => {
  const lines: string[] = [];
  const flatNodes = flattenTreeForExport(root); // Reuse flattener for progress tracking
  const totalNodes = flatNodes.length;
  let processedCount = 0;

  const processNode = (node: HotelNode, depth: number) => {
    const indent = "  ".repeat(depth);
    let marker = "-";
    
    // Use Headers for high-level categories to give structure
    if (depth === 0) marker = "#";
    else if (depth === 1 && node.type === 'category') marker = "##";
    else if (depth === 2 && node.type === 'category') marker = "###";

    // Construct the line
    let content = `${indent}${marker} ${node.name || 'Untitled'}`;

    // Add Primary Value
    if (node.value) content += `: ${node.value}`;
    if (node.question) content += ` (Q: ${node.question})`;
    if (node.answer) content += ` (A: ${node.answer})`;

    // Add Attributes in a compact [Key: Value] format
    const attrs = [];
    if (node.price) attrs.push(`$${node.price}`);
    if (node.startTime && node.endTime) attrs.push(`${node.startTime}-${node.endTime}`);
    if (node.eventStatus) attrs.push(`${node.eventStatus}`);
    if (node.tags && node.tags.length > 0) attrs.push(`Tags: ${node.tags.join(',')}`);
    if (node.description) attrs.push(`Note: ${node.description}`);
    
    if (attrs.length > 0) {
      content += ` [${attrs.join(' | ')}]`;
    }

    lines.push(content);
    processedCount++;

    // Recursion
    if (node.children) {
      node.children.forEach(child => processNode(child, depth + 1));
    }
  };

  // Run synchronously but chunked if needed (Text generation is usually fast, but keeping pattern)
  processNode(root, 0);
  onProgress(100);

  return lines.join('\n');
};

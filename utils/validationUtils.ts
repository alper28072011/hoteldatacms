
import { HotelNode, HealthIssue, IssueSeverity } from '../types';
import { generateId } from './treeUtils';

/**
 * Validates a single node's input before UI updates to prevent bad patterns.
 * Returns an error string if invalid, or null if valid.
 */
export const validateNodeInput = (node: HotelNode): string | null => {
  // RULE 1: Categories/Lists should not have main values (only description)
  if (['category', 'list', 'menu', 'root'].includes(String(node.type))) {
     if (node.value && node.value.length > 5 && !node.value.includes('http')) { 
        // We allow short codes or URLs, but prevent long text in 'Value' for containers
        return "Kategoriler/Listeler için 'Main Value' alanı kullanılmaz. Lütfen 'Internal Note' veya açıklama kullanın.";
     }
  }

  // RULE 2: Structural Integrity
  if (node.children && node.children.length > 0) {
      if (['item', 'field', 'menu_item', 'qa_pair'].includes(String(node.type))) {
          return "Bu öğenin alt öğeleri var. Tipi 'Item' yerine 'Category' veya 'List' olmalı.";
      }
  }

  return null;
};

/**
 * Runs all local validation rules and combines the results.
 */
export const runLocalValidation = (root: HotelNode): HealthIssue[] => {
  const issues: HealthIssue[] = [];
  
  // Build a set of known definitions for Relational Checks
  const definedTerms = new Set<string>();
  const collectDefinitions = (node: HotelNode) => {
      if (['list', 'menu', 'policy', 'category'].includes(String(node.type)) && node.name) {
          definedTerms.add(node.name.trim());
      }
      node.children?.forEach(collectDefinitions);
  };
  collectDefinitions(root);

  // 1. Empty/Missing Data Check
  issues.push(...findEmptyNodes(root));

  // 2. Structural Depth & Logic Check
  issues.push(...findStructuralIssues(root));

  // 3. Duplicate Siblings Check
  issues.push(...findDuplicateSiblings(root));

  // 4. Relational Integrity (Broken Links)
  issues.push(...findBrokenReferences(root, definedTerms));

  // 5. Missing Service Details
  issues.push(...findMissingServiceDetails(root));

  return issues;
};

const createIssue = (
  node: HotelNode, 
  severity: IssueSeverity, 
  message: string, 
  fixAction?: string, 
  fixData?: any
): HealthIssue => ({
  id: `local_issue_${generateId()}`,
  nodeId: node.id,
  nodeName: node.name || 'Unnamed Node',
  severity,
  message,
  fix: fixAction ? {
    targetId: node.id,
    action: 'update',
    data: fixData || {},
    description: fixAction
  } : undefined
});

const findEmptyNodes = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
  if (!node.name || node.name.trim() === '') {
    issues.push(createIssue(node, 'critical', 'Node has no name.', 'Set Name', { name: 'New Item' }));
  } else if (node.name.toLowerCase() === 'new item' || node.name.toLowerCase() === 'untitled') {
    issues.push(createIssue(node, 'warning', 'Node has default placeholder name.', 'Rename', {}));
  }

  if (['item', 'field'].includes(String(node.type))) {
    if ((!node.value || node.value.trim() === '') && (!node.attributes || node.attributes.length === 0)) {
      issues.push(createIssue(node, 'warning', `Field "${node.name}" is empty.`, 'Set Placeholder', { value: 'TBD' }));
    }
  }

  if (node.type === 'menu_item') {
    if (!node.price && node.price !== 0) {
      issues.push(createIssue(node, 'warning', `Menu item "${node.name}" has no price.`, 'Set Price', { price: '0' }));
    }
  }

  if (node.type === 'qa_pair') {
    if (!node.answer || node.answer.trim() === '') {
      issues.push(createIssue(node, 'critical', `Question "${node.question || 'Unknown'}" has no answer.`, 'Set Answer', { answer: 'Answer pending.' }));
    }
  }

  if (node.children) {
    node.children.forEach(child => findEmptyNodes(child, issues));
  }

  return issues;
};

const findStructuralIssues = (node: HotelNode, depth: number = 0, issues: HealthIssue[] = []): HealthIssue[] => {
  if (depth > 5) {
    issues.push(createIssue(node, 'optimization', `Nesting level (${depth}) is too deep for good UX.`, undefined));
  }

  if (node.type === 'field' && node.children && node.children.length > 0) {
    issues.push(createIssue(node, 'warning', `Node "${node.name}" is a 'field' type but has children. Should it be a 'category'?`, 'Convert to Category', { type: 'category' }));
  }

  if (node.children) {
    node.children.forEach(child => findStructuralIssues(child, depth + 1, issues));
  }

  return issues;
};

const findDuplicateSiblings = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
  if (node.children && node.children.length > 1) {
    const nameMap = new Map<string, number>();
    
    node.children.forEach(child => {
      const name = (child.name || '').trim().toLowerCase();
      if (name) {
        nameMap.set(name, (nameMap.get(name) || 0) + 1);
      }
    });

    node.children.forEach(child => {
      const name = (child.name || '').trim().toLowerCase();
      if (nameMap.get(name)! > 1) {
        issues.push(createIssue(child, 'critical', `Duplicate name "${child.name}" found in same category.`, 'Rename', { name: `${child.name} (Copy)` }));
      }
    });
    
    node.children.forEach(child => findDuplicateSiblings(child, issues));
  }

  return issues;
};

const findBrokenReferences = (node: HotelNode, definedTerms: Set<string>, issues: HealthIssue[] = []): HealthIssue[] => {
    if (node.type === 'field' || node.type === 'item') {
        const value = node.value?.trim();
        if (value && value.length > 3 && /^[A-Z]/.test(value)) {
             const isCommonWord = ['Yes', 'No', 'Available', 'Free', 'Paid', 'Included'].includes(value);
             if (!isCommonWord && !definedTerms.has(value)) {
                 issues.push(createIssue(
                     node, 
                     'warning', 
                     `Potential Broken Reference: Value "${value}" looks like a named entity but is not defined in the system.`, 
                     undefined
                 ));
             }
        }
    }
    if (node.children) {
        node.children.forEach(c => findBrokenReferences(c, definedTerms, issues));
    }
    return issues;
}

const findMissingServiceDetails = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
    const isService = node.name?.toLowerCase().includes('service') || 
                      node.name?.toLowerCase().includes('restaurant') || 
                      node.name?.toLowerCase().includes('bar') ||
                      node.type === 'item'; 
    
    if (isService && node.children && node.children.length === 0) { 
        const hasTime = node.attributes?.some(a => a.key.toLowerCase().includes('time') || a.key.toLowerCase().includes('open') || a.key.toLowerCase().includes('hour'));
        const hasLocation = node.attributes?.some(a => a.key.toLowerCase().includes('location') || a.key.toLowerCase().includes('where'));
        
        if (!hasTime && !hasLocation && !node.value?.includes(':') && (!node.attributes || node.attributes.length === 0)) {
             issues.push(createIssue(
                 node, 
                 'optimization', 
                 `Service "${node.name}" lacks details (Time, Location, etc).`, 
                 'Add Attribute', 
                 { attributes: [...(node.attributes || []), { id: `attr_${Date.now()}`, key: 'Opening Hours', value: '09:00 - 18:00', type: 'text' }] }
             ));
        }
    }

    if (node.children) {
        node.children.forEach(c => findMissingServiceDetails(c, issues));
    }
    return issues;
}

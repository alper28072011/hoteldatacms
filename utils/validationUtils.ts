
import { HotelNode, HealthIssue, IssueSeverity } from '../types';
import { generateId } from './treeUtils';

/**
 * Runs all local validation rules and combines the results.
 */
export const runLocalValidation = (root: HotelNode): HealthIssue[] => {
  const issues: HealthIssue[] = [];
  
  // 1. Empty/Missing Data Check
  issues.push(...findEmptyNodes(root));

  // 2. Structural Depth & Logic Check
  issues.push(...findStructuralIssues(root));

  // 3. Duplicate Siblings Check
  issues.push(...findDuplicateSiblings(root));

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

/**
 * RULE 1: Find Empty Nodes
 * Checks for missing names or missing required values based on type.
 */
const findEmptyNodes = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
  // Check Name
  if (!node.name || node.name.trim() === '') {
    issues.push(createIssue(node, 'critical', 'Node has no name.', 'Set Name', { name: 'New Item' }));
  } else if (node.name.toLowerCase() === 'new item' || node.name.toLowerCase() === 'untitled') {
    issues.push(createIssue(node, 'warning', 'Node has default placeholder name.', 'Rename', {}));
  }

  // Check Value based on Type
  if (['item', 'field'].includes(String(node.type))) {
    if (!node.value || node.value.trim() === '') {
      issues.push(createIssue(node, 'warning', `Field "${node.name}" is empty.`, 'Set Placeholder', { value: 'TBD' }));
    }
  }

  // Check Menu Items
  if (node.type === 'menu_item') {
    if (!node.price && node.price !== 0) {
      issues.push(createIssue(node, 'warning', `Menu item "${node.name}" has no price.`, 'Set Price', { price: '0' }));
    }
  }

  // Check Q&A
  if (node.type === 'qa_pair') {
    if (!node.answer || node.answer.trim() === '') {
      issues.push(createIssue(node, 'critical', `Question "${node.question || 'Unknown'}" has no answer.`, 'Set Answer', { answer: 'Answer pending.' }));
    }
  }

  // Recurse
  if (node.children) {
    node.children.forEach(child => findEmptyNodes(child, issues));
  }

  return issues;
};

/**
 * RULE 2: Structural Issues
 * Checks for excessive depth or odd typing.
 */
const findStructuralIssues = (node: HotelNode, depth: number = 0, issues: HealthIssue[] = []): HealthIssue[] => {
  // Max Depth Warning (UX Rule: Don't go deeper than 5 levels)
  if (depth > 5) {
    issues.push(createIssue(node, 'optimization', `Nesting level (${depth}) is too deep for good UX.`, undefined));
  }

  // Type Logic: A 'field' should rarely have children
  if (node.type === 'field' && node.children && node.children.length > 0) {
    issues.push(createIssue(node, 'warning', `Node "${node.name}" is a 'field' type but has children. Should it be a 'category'?`, 'Convert to Category', { type: 'category' }));
  }

  // Recurse
  if (node.children) {
    node.children.forEach(child => findStructuralIssues(child, depth + 1, issues));
  }

  return issues;
};

/**
 * RULE 3: Duplicate Siblings
 * Checks if siblings have the exact same name (confusing for users/AI).
 */
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
        // We only flag one instance per traversal pass effectively, but that's fine for local check
        // To avoid duplicate issues for the same pair, we could use a set, but simple is better here.
        // We'll just flag it.
        // Check if we haven't already flagged this node ID in this pass (not possible in recursion logic easily without set)
        // Optimization: Just push it.
        issues.push(createIssue(child, 'critical', `Duplicate name "${child.name}" found in same category.`, 'Rename', { name: `${child.name} (Copy)` }));
      }
    });
    
    // Recurse
    node.children.forEach(child => findDuplicateSiblings(child, issues));
  }

  return issues;
};

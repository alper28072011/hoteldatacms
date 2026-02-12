
import React, { useState, useEffect, useRef } from 'react';
import { HotelNode } from '../types';
import { ChevronRight, Folder, FileText, Plus, List, Calendar, CircleHelp, Shield } from 'lucide-react';

interface TreeViewNodeProps {
  node: HotelNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  level?: number;
  forceExpand?: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  // Updated signature to include position
  onDrop: (e: React.DragEvent, targetId: string, position: 'inside' | 'before' | 'after') => void;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'root': return <Folder size={14} className="text-slate-500" />;
    case 'category': return <Folder size={14} className="text-blue-500" />;
    case 'list': return <List size={14} className="text-indigo-500" />;
    case 'item': return <FileText size={14} className="text-slate-500" />;
    case 'event': return <Calendar size={14} className="text-purple-500" />;
    case 'qa_pair': return <CircleHelp size={14} className="text-green-500" />;
    case 'policy': return <Shield size={14} className="text-red-500" />;
    default: return <FileText size={14} className="text-gray-400" />;
  }
};

const TreeViewNode: React.FC<TreeViewNodeProps> = React.memo(({ 
  node, 
  selectedId, 
  onSelect, 
  onAddChild, 
  level = 0,
  forceExpand = false,
  onDragStart,
  // onDragOver prop is kept for compatibility but logic is handled internally for specific zones
  onDrop
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level === 0 || forceExpand);
  
  // New State for Smart Drop Zones
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | 'inside' | null>(null);
  
  const nodeRef = useRef<HTMLDivElement>(null);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  useEffect(() => {
    if (forceExpand && hasChildren) {
      setIsExpanded(true);
      setHasRenderedChildren(true);
    }
  }, [forceExpand, hasChildren]);

  useEffect(() => {
    if (isExpanded) {
      setHasRenderedChildren(true);
    }
  }, [isExpanded]);

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(node.id);
  }

  const handleDragStartInternal = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStart(e, node.id);
  };

  // --- SMART DRAG OVER LOGIC ---
  const handleDragOverInternal = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();

    if (!nodeRef.current) return;

    const rect = nodeRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top; // Y position relative to the element
    const height = rect.height;

    // Logic: Top 25% -> Before, Bottom 25% -> After, Middle 50% -> Inside
    if (y < height * 0.25) {
        setDragOverPosition('top');
    } else if (y > height * 0.75) {
        setDragOverPosition('bottom');
    } else {
        setDragOverPosition('inside');
    }
  };

  const handleDragLeaveInternal = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPosition(null);
  };

  const handleDropInternal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let position: 'inside' | 'before' | 'after' = 'inside';
    
    if (dragOverPosition === 'top') position = 'before';
    else if (dragOverPosition === 'bottom') position = 'after';
    
    // Safety: Reset state
    setDragOverPosition(null);
    
    // Check if dropping on itself (handled by parent usually, but good to check)
    const sourceId = e.dataTransfer.getData('nodeId');
    if (sourceId === node.id) return;

    onDrop(e, node.id, position);
  };

  return (
    <div className="select-none relative">
      <div 
        ref={nodeRef}
        className={`
          group relative flex items-center py-1.5 pr-4 cursor-pointer transition-all duration-200 border-l-2
          ${isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-slate-50'}
          ${dragOverPosition === 'inside' ? 'bg-blue-100 ring-1 ring-inset ring-blue-300' : ''}
        `}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={handleSelect}
        draggable
        onDragStart={handleDragStartInternal}
        onDragOver={handleDragOverInternal}
        onDragLeave={handleDragLeaveInternal}
        onDrop={handleDropInternal}
      >
        {/* --- VISUAL DROP INDICATORS --- */}
        {dragOverPosition === 'top' && (
            <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500 z-50 pointer-events-none shadow-sm" />
        )}
        {dragOverPosition === 'bottom' && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 z-50 pointer-events-none shadow-sm" />
        )}

        <div className="flex items-center flex-1 overflow-hidden pointer-events-none"> {/* content pointer-events-none to prevent flickering */}
          <button 
            type="button"
            onClick={handleExpand}
            className={`
                p-0.5 rounded mr-1 text-slate-400 shrink-0 transition-transform duration-300 pointer-events-auto
                ${hasChildren ? 'opacity-100 hover:bg-slate-200 hover:text-slate-600' : 'opacity-0 cursor-default'}
                ${isExpanded ? 'rotate-90' : 'rotate-0'}
            `}
          >
            <ChevronRight size={12} />
          </button>
          
          <span className="mr-2 opacity-90 shrink-0">
            {getNodeIcon(String(node.type))}
          </span>
          
          <span className={`text-sm truncate transition-colors duration-200 ${isSelected ? 'font-medium text-blue-700' : 'text-slate-600'}`}>
            {node.name || <span className="italic opacity-50">Unnamed {node.type}</span>}
          </span>
        </div>

        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 backdrop-blur-[2px] rounded p-0.5 z-10 shadow-sm">
          <button 
            type="button"
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation(); 
              onAddChild(node.id); 
              setIsExpanded(true); 
              setHasRenderedChildren(true);
            }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded shadow-sm border border-slate-200 bg-white transition-colors pointer-events-auto"
            title="Add Child"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div 
        className={`
            grid transition-[grid-template-rows] duration-300 ease-out contain-content
            ${isExpanded && hasChildren ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
        `}
      >
        <div className={`
            overflow-hidden min-h-0 transition-opacity duration-300
            ${isExpanded && hasChildren ? 'opacity-100' : 'opacity-0'}
        `}>
            {hasChildren && hasRenderedChildren && node.children!.map((child) => (
                <TreeViewNode 
                  key={child.id} 
                  node={child} 
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  level={level + 1}
                  forceExpand={forceExpand}
                  onDragStart={onDragStart}
                  onDragOver={(e) => {}} // No-op, handled internally
                  onDrop={onDrop}
                />
            ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  // RELAXED COMPARISON to fix "stuck selection" bugs.
  // We strictly check if the node object reference changed or the selection state changed.
  // We ignore function props as they are stable from App.tsx context/useCallbacks.
  return prev.node === next.node && prev.selectedId === next.selectedId && prev.forceExpand === next.forceExpand;
});

export default TreeViewNode;

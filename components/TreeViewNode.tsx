
import React, { useState, useEffect } from 'react';
import { HotelNode } from '../types';
import { ChevronRight, Folder, FileText, Plus, List, Calendar, HelpCircle, Shield, GripVertical } from 'lucide-react';
import { useHotel } from '../contexts/HotelContext';

interface TreeViewNodeProps {
  node: HotelNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  level?: number;
  forceExpand?: boolean;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'root': return <Folder size={14} className="text-slate-500" />;
    case 'category': return <Folder size={14} className="text-blue-500" />;
    case 'list': return <List size={14} className="text-indigo-500" />;
    case 'item': return <FileText size={14} className="text-slate-500" />;
    case 'event': return <Calendar size={14} className="text-purple-500" />;
    case 'qa_pair': return <HelpCircle size={14} className="text-green-500" />;
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
  forceExpand = false
}) => {
  // Use Context hook inside component to avoid prop drilling for moveNode
  const { moveNode } = useHotel();

  const [isExpanded, setIsExpanded] = useState(level === 0);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level === 0 || forceExpand);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [dropPosition, setDropPosition] = useState<'none' | 'inside' | 'before' | 'after'>('none');

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const isRoot = node.id === 'root';

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

  // --- DRAG HANDLERS ---
  const handleDragStart = (e: React.DragEvent) => {
    if (isRoot) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    
    // Create a ghost image if needed, or browser default is fine
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDropPosition('none');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();

    if (isDragging) return; // Don't drop on self

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Logic: Top 25% = Before, Bottom 25% = After, Middle 50% = Inside
    // Exception: Root can only accept 'inside'
    if (isRoot) {
       setDropPosition('inside');
       return;
    }

    if (y < height * 0.25) {
      setDropPosition('before');
    } else if (y > height * 0.75) {
      setDropPosition('after');
    } else {
      setDropPosition('inside');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
     e.preventDefault();
     setDropPosition('none');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPosition('none');

    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== node.id) {
       moveNode(sourceId, node.id, dropPosition === 'none' ? 'inside' : dropPosition);
       // Auto expand if dropped inside
       if (dropPosition === 'inside' || isRoot) {
         setIsExpanded(true);
         setHasRenderedChildren(true);
       }
    }
  };

  // Styles for Drop Targets
  const getDropStyles = () => {
    switch (dropPosition) {
      case 'inside': return 'bg-blue-100 ring-1 ring-blue-300';
      case 'before': return 'border-t-2 border-blue-500';
      case 'after': return 'border-b-2 border-blue-500';
      default: return isSelected ? 'bg-blue-50 border-blue-500' : 'hover:bg-slate-50 border-transparent';
    }
  };

  return (
    <div className={`select-none ${isDragging ? 'opacity-50' : ''}`}>
      {/* Node Header Row */}
      <div 
        draggable={!isRoot}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          group relative flex items-center py-1.5 pr-4 cursor-pointer transition-all duration-150 border-l-2
          ${getDropStyles()}
        `}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={handleSelect}
      >
        <div className="flex items-center flex-1 overflow-hidden">
          {/* Drag Handle (Hover Only) */}
          {!isRoot && (
             <span className="opacity-0 group-hover:opacity-30 cursor-grab mr-1 -ml-1 hover:opacity-100 transition-opacity">
                <GripVertical size={10} />
             </span>
          )}

          {/* Animated Toggle Button */}
          <button 
            type="button"
            onClick={handleExpand}
            className={`
                p-0.5 rounded mr-1 text-slate-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
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

        {/* Quick Actions (Hover) */}
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
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded shadow-sm border border-slate-200 bg-white transition-colors"
            title="Add Child"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* 
         PERFORMANCE WRAPPER (Lazy Rendering + Grid Animation)
      */}
      <div 
        className={`
            grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] contain-content
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
                />
            ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  // --- PERFORMANCE OPTIMIZATION ---
  const isSameNode = prev.node === next.node;
  const wasSelected = prev.selectedId === prev.node.id;
  const isNowSelected = next.selectedId === next.node.id;
  const isSelectionChanged = wasSelected !== isNowSelected;
  const isExpandChanged = prev.forceExpand !== next.forceExpand;
  
  return isSameNode && !isSelectionChanged && !isExpandChanged;
});

export default TreeViewNode;

import React, { useState, useEffect } from 'react';
import { HotelNode } from '../types';
import { ChevronRight, Folder, FileText, Plus, List, Calendar, CircleHelp, Shield } from 'lucide-react'; // GÜNCELLENDİ

interface TreeViewNodeProps {
  node: HotelNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  level?: number;
  forceExpand?: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case 'root': return <Folder size={14} className="text-slate-500" />;
    case 'category': return <Folder size={14} className="text-blue-500" />;
    case 'list': return <List size={14} className="text-indigo-500" />;
    case 'item': return <FileText size={14} className="text-slate-500" />;
    case 'event': return <Calendar size={14} className="text-purple-500" />;
    case 'qa_pair': return <CircleHelp size={14} className="text-green-500" />; // GÜNCELLENDİ
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
  onDragOver,
  onDrop
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level === 0 || forceExpand);

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

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStart(e, node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    onDragOver(e, node.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, node.id);
  };

  return (
    <div className="select-none">
      <div 
        className={`
          group relative flex items-center py-1.5 pr-4 cursor-pointer transition-colors duration-200 border-l-2
          ${isSelected ? 'bg-blue-50 border-blue-500' : 'hover:bg-slate-50 border-transparent'}
        `}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={handleSelect}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex items-center flex-1 overflow-hidden">
          <button 
            type="button"
            onClick={handleExpand}
            className={`
                p-0.5 rounded mr-1 text-slate-400 shrink-0 transition-transform duration-300
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
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded shadow-sm border border-slate-200 bg-white transition-colors"
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
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
            ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  const isSameNode = prev.node === next.node;
  const wasSelected = prev.selectedId === prev.node.id;
  const isNowSelected = next.selectedId === next.node.id;
  const isSelectionChanged = wasSelected !== isNowSelected;
  const isExpandChanged = prev.forceExpand !== next.forceExpand;
  return isSameNode && !isSelectionChanged && !isExpandChanged;
});

export default TreeViewNode;
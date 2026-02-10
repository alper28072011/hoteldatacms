import React, { useState, useEffect } from 'react';
import { HotelNode } from '../types';
import { ChevronRight, Folder, FileText, Plus, List, Calendar, HelpCircle, Shield } from 'lucide-react';

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

// React.memo ile sarmalanmış optimize bileşen
const TreeViewNode: React.FC<TreeViewNodeProps> = React.memo(({ 
  node, 
  selectedId, 
  onSelect, 
  onAddChild, 
  level = 0,
  forceExpand = false
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  // Performans: Eğer çocuklar hiç açılmadıysa DOM'a render etme (Virtualization benzeri etki)
  const [hasRenderedChildren, setHasRenderedChildren] = useState(level === 0 || forceExpand);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  // Dışarıdan zorla genişletme gelirse (örn: arama yapıldığında)
  useEffect(() => {
    if (forceExpand && hasChildren) {
      setIsExpanded(true);
      setHasRenderedChildren(true);
    }
  }, [forceExpand, hasChildren]);

  // Kullanıcı manuel açarsa render izni ver
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

  return (
    <div className="select-none">
      {/* Satır Görünümü */}
      <div 
        className={`
          group relative flex items-center py-1.5 pr-4 cursor-pointer transition-colors duration-200 border-l-2
          ${isSelected ? 'bg-blue-50 border-blue-500' : 'hover:bg-slate-50 border-transparent'}
        `}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={handleSelect}
      >
        <div className="flex items-center flex-1 overflow-hidden">
          {/* Aç/Kapa Oku */}
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

        {/* Hover ile Gelen Ekle Butonu */}
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

      {/* Çocuklar (Recursive Render) */}
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
                />
            ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  // --- PERFORMANS SİHRİ BURADA ---
  
  // 1. Veri Referansı Kontrolü (TreeUtils sayesinde çok hızlı)
  const isSameNode = prev.node === next.node;
  
  // 2. Seçim Durumu Kontrolü
  // Sadece eğer "ben seçildim" veya "seçim benden gitti" durumu varsa render et.
  // Başka bir node seçildiyse beni ilgilendirmez.
  const wasSelected = prev.selectedId === prev.node.id;
  const isNowSelected = next.selectedId === next.node.id;
  const isSelectionChanged = wasSelected !== isNowSelected;
  
  // 3. Genişleme (Expand) Kontrolü
  const isExpandChanged = prev.forceExpand !== next.forceExpand;

  // Eğer her şey aynıysa TRUE dön (Render Etme!)
  return isSameNode && !isSelectionChanged && !isExpandChanged;
});

export default TreeViewNode;
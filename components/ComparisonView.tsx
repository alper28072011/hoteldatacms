import React, { useState, useEffect, useMemo } from 'react';
import { 
  HotelNode, 
  HotelSummary, 
  LocalizedText 
} from '../types';
import { 
  getLocalizedValue, 
  ensureLocalized, 
  generateId, 
  generateSlug,
  updateNodeInTree, 
  addChildToNode, 
  deleteNodeFromTree,
  findNodeById 
} from '../utils/treeUtils';
import { 
  getHotelsList, 
  fetchHotelById, 
  updateHotelData 
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useHotel } from '../contexts/HotelContext';
import { 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Plus, 
  Copy, 
  ArrowRight, 
  RefreshCw, 
  Search, 
  Filter, 
  Sparkles, 
  Edit3, 
  Save, 
  Eye, 
  Loader2, 
  Check, 
  ChevronRight, 
  ChevronDown, 
  Globe, 
  Layers, 
  Zap, 
  Layout, 
  Grid, 
  GitCompare, 
  ShieldAlert, 
  Info, 
  ArrowUpDown,
  CheckSquare,
  Building2,
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  PlusCircle,
  Sliders,
  Settings,
  Share2
} from 'lucide-react';

interface ComparisonViewProps {
  onSwitchToEditor: (hotelId?: string) => void;
}

interface CategorizedRow {
  key: string;
  idSlug: string;
  trName: string;
  enName: string;
  isSharedAny: boolean;
  type?: string;
  presentInHotels: { [hotelId: string]: HotelNode | null };
  subRows?: CategorizedRow[];
}

interface AuditIssue {
  id: string;
  type: 'missing_category' | 'missing_subnode' | 'order_mismatch' | 'shared_mismatch' | 'empty_content';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  targetHotelId?: string;
  sourceHotelId?: string;
  categoryName?: string;
  nodeData?: HotelNode;
  fixAction: () => Promise<void>;
}

interface TransferModalState {
  targetHotelId: string;
  categoryKey: string;
  trName: string;
  enName: string;
  isSubNode?: boolean;
  parentCategoryKey?: string;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ onSwitchToEditor }) => {
  const { userRole, allowedHotels } = useAuth();
  const { hotelId: currentActiveHotelId, setHotelData: setContextHotelData, setHotelId: setContextHotelId } = useHotel();
  
  const canEdit = useMemo(() => {
    if (userRole === 'superadmin') return true;
    if (userRole === 'editor') return true;
    return false;
  }, [userRole]);

  // Main States
  const [hotelsList, setHotelsList] = useState<HotelSummary[]>([]);
  const [hotelsData, setHotelsData] = useState<Record<string, HotelNode>>({});
  const [loading, setLoading] = useState(true);
  const [savingHotelId, setSavingHotelId] = useState<string | null>(null);
  
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'sidebyside' | 'bulk' | 'audit'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [diffOnly, setDiffOnly] = useState(false);
  const [benchmarkHotelId, setBenchmarkHotelId] = useState<string>('');
  
  // Expanded rows in matrix
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Side by Side comparison selected hotels
  const [sideHotelA, setSideHotelA] = useState<string>('');
  const [sideHotelB, setSideHotelB] = useState<string>('');

  // Node editing modal (Single or Multi-facility)
  const [editingModalNode, setEditingModalNode] = useState<{ hotelId: string; node: HotelNode; parentNodeKey?: string } | null>(null);
  const [editingNodeIdSlug, setEditingNodeIdSlug] = useState('');
  const [editingNodeType, setEditingNodeType] = useState<string>('category');
  const [editingTrName, setEditingTrName] = useState('');
  const [editingEnTrName, setEditingEnTrName] = useState('');
  const [editingValTr, setEditingValTr] = useState('');
  const [editingValEn, setEditingValEn] = useState('');
  const [editingIsShared, setEditingIsShared] = useState(false);
  const [editingChildren, setEditingChildren] = useState<HotelNode[]>([]);
  const [applyScope, setApplyScope] = useState<'single' | 'selected' | 'all'>('single');

  // Modal sub-child creation form
  const [showModalAddChild, setShowModalAddChild] = useState(false);
  const [modalNewChildTr, setModalNewChildTr] = useState('');
  const [modalNewChildEn, setModalNewChildEn] = useState('');
  const [modalNewChildId, setModalNewChildId] = useState('');

  // Transfer / Copy Modal State ("Yok" cell click)
  const [transferModal, setTransferModal] = useState<TransferModalState | null>(null);
  const [selectedSourceHotelId, setSelectedSourceHotelId] = useState<string>('');
  const [applyToAllMissing, setApplyToAllMissing] = useState(false);

  // Bulk Multi-Facility Editor Tab States
  const [selectedBulkCategoryKey, setSelectedBulkCategoryKey] = useState<string>('');
  const [bulkTrName, setBulkTrName] = useState('');
  const [bulkEnName, setBulkEnName] = useState('');
  const [bulkIdSlug, setBulkIdSlug] = useState('');
  const [bulkNodeType, setBulkNodeType] = useState('category');
  const [bulkIsShared, setBulkIsShared] = useState(false);
  const [bulkSubNodes, setBulkSubNodes] = useState<{ id: string; tr: string; en: string; type?: string }[]>([]);
  const [bulkHotelDescriptions, setBulkHotelDescriptions] = useState<Record<string, { tr: string; en: string }>>({});
  
  // Bulk sub-node addition form
  const [showNewBulkSubForm, setShowNewBulkSubForm] = useState(false);
  const [newBulkSubTr, setNewBulkSubTr] = useState('');
  const [newBulkSubEn, setNewBulkSubEn] = useState('');
  const [newBulkSubId, setNewBulkSubId] = useState('');
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Toast / notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load all hotels data
  const loadAllHotels = async () => {
    setLoading(true);
    try {
      const list = await getHotelsList();
      setHotelsList(list);
      
      const allIds = list.map(h => h.id);
      setSelectedHotelIds(allIds);

      if (allIds.length > 0) {
        setBenchmarkHotelId(allIds[0]);
        setSideHotelA(allIds[0]);
        setSideHotelB(allIds.length > 1 ? allIds[1] : allIds[0]);
      }

      const loadedMap: Record<string, HotelNode> = {};
      await Promise.all(
        list.map(async (item) => {
          try {
            const data = await fetchHotelById(item.id);
            if (data) {
              loadedMap[item.id] = data;
            }
          } catch (e) {
            console.error(`Failed to load hotel ${item.id}`, e);
          }
        })
      );

      setHotelsData(loadedMap);
    } catch (err) {
      console.error("Error loading comparison data", err);
      showNotification("Otel verileri yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllHotels();
  }, []);

  // Save updated hotel tree to database & state
  const saveHotelTree = async (hotelId: string, updatedTree: HotelNode) => {
    setSavingHotelId(hotelId);
    try {
      await updateHotelData(hotelId, updatedTree);
      
      setHotelsData(prev => ({
        ...prev,
        [hotelId]: updatedTree
      }));

      if (hotelId === currentActiveHotelId) {
        setContextHotelData(updatedTree);
      }
    } catch (e: any) {
      console.error(`Error saving hotel ${hotelId}`, e);
      showNotification(`Otel kaydedilemedi: ${e.message || 'Bilinmeyen hata'}`, "error");
    } finally {
      setSavingHotelId(null);
    }
  };

  const handleToggleHotelSelection = (id: string) => {
    setSelectedHotelIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const getNodeName = (node: HotelNode | null | undefined, lang: 'tr' | 'en' = 'tr'): string => {
    if (!node) return '';
    return getLocalizedValue(node.name, lang);
  };

  const getNodeKey = (node: HotelNode): string => {
    const tr = getLocalizedValue(node.name, 'tr').trim().toLowerCase();
    return tr || node.id;
  };

  // Build aggregated category structure matrix
  const categoryMatrix = useMemo<CategorizedRow[]>(() => {
    const activeHotels = selectedHotelIds.map(id => ({ id, data: hotelsData[id] })).filter(h => h.data);
    if (activeHotels.length === 0) return [];

    const categoryMap: Map<string, {
      trName: string;
      enName: string;
      type?: string;
      isSharedAny: boolean;
      presentInHotels: { [hotelId: string]: HotelNode | null };
      subNodesMap: Map<string, {
        trName: string;
        enName: string;
        type?: string;
        isSharedAny: boolean;
        presentInHotels: { [hotelId: string]: HotelNode | null };
      }>;
    }> = new Map();

    activeHotels.forEach(({ id, data }) => {
      const topChildren = data.children || [];
      topChildren.forEach(child => {
        const key = getNodeKey(child);
        const trName = getNodeName(child, 'tr');
        const enName = getNodeName(child, 'en');

        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            trName,
            enName,
            type: child.type,
            isSharedAny: !!child.isShared,
            presentInHotels: {},
            subNodesMap: new Map()
          });
        }

        const entry = categoryMap.get(key)!;
        entry.presentInHotels[id] = child;
        if (child.isShared) entry.isSharedAny = true;
        if (!entry.enName && enName) entry.enName = enName;

        (child.children || []).forEach(subChild => {
          const subKey = getNodeKey(subChild);
          const subTrName = getNodeName(subChild, 'tr');
          const subEnName = getNodeName(subChild, 'en');

          if (!entry.subNodesMap.has(subKey)) {
            entry.subNodesMap.set(subKey, {
              trName: subTrName,
              enName: subEnName,
              type: subChild.type,
              isSharedAny: !!subChild.isShared,
              presentInHotels: {}
            });
          }

          const subEntry = entry.subNodesMap.get(subKey)!;
          subEntry.presentInHotels[id] = subChild;
          if (subChild.isShared) subEntry.isSharedAny = true;
        });
      });
    });

    let rows: CategorizedRow[] = Array.from(categoryMap.entries()).map(([key, item]) => {
      const subRows: CategorizedRow[] = Array.from(item.subNodesMap.entries()).map(([subKey, subItem]) => ({
        key: `${key}___${subKey}`,
        idSlug: subKey,
        trName: subItem.trName,
        enName: subItem.enName,
        type: subItem.type,
        isSharedAny: subItem.isSharedAny,
        presentInHotels: subItem.presentInHotels
      }));

      return {
        key,
        idSlug: key,
        trName: item.trName,
        enName: item.enName,
        type: item.type,
        isSharedAny: item.isSharedAny,
        presentInHotels: item.presentInHotels,
        subRows
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        r.trName.toLowerCase().includes(q) || 
        r.enName.toLowerCase().includes(q) ||
        r.subRows?.some(sr => sr.trName.toLowerCase().includes(q) || sr.enName.toLowerCase().includes(q))
      );
    }

    if (diffOnly) {
      rows = rows.filter(r => {
        const hotelCounts = selectedHotelIds.map(hId => r.presentInHotels[hId] ? 1 : 0);
        const hasMissing = hotelCounts.some(c => c === 0);
        const hasSubDiffs = r.subRows?.some(sr => {
          const subCounts = selectedHotelIds.map(hId => sr.presentInHotels[hId] ? 1 : 0);
          return subCounts.some(c => c === 0);
        });
        return hasMissing || hasSubDiffs;
      });
    }

    return rows;
  }, [selectedHotelIds, hotelsData, searchQuery, diffOnly]);

  // Copy category to target hotel
  const handleCopyCategoryToHotel = async (sourceNode: HotelNode, targetHotelId: string) => {
    const targetTree = hotelsData[targetHotelId];
    if (!targetTree) return;

    const existing = (targetTree.children || []).find(c => getNodeKey(c) === getNodeKey(sourceNode));
    if (existing) {
      showNotification(`${targetTree.name?.tr || targetHotelId} tesisinde bu kategori zaten mevcut.`, "info");
      return;
    }

    const clonedNode: HotelNode = JSON.parse(JSON.stringify(sourceNode));
    clonedNode.id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const reassignIds = (node: HotelNode) => {
      node.id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (node.children) node.children.forEach(reassignIds);
    };
    if (clonedNode.children) clonedNode.children.forEach(reassignIds);

    const updatedTree: HotelNode = {
      ...targetTree,
      children: [...(targetTree.children || []), clonedNode]
    };

    await saveHotelTree(targetHotelId, updatedTree);
    const targetHotelName = hotelsList.find(h => h.id === targetHotelId)?.name || targetHotelId;
    showNotification(`"${getNodeName(sourceNode)}" kategorisi ${targetHotelName} tesisine eklendi.`, "success");
  };

  const handlePropagateCategoryToAllHotels = async (sourceNode: HotelNode) => {
    const sourceKey = getNodeKey(sourceNode);
    let updatedCount = 0;

    for (const hId of selectedHotelIds) {
      const tree = hotelsData[hId];
      if (!tree) continue;

      const exists = (tree.children || []).some(c => getNodeKey(c) === sourceKey);
      if (!exists) {
        await handleCopyCategoryToHotel(sourceNode, hId);
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      showNotification(`"${getNodeName(sourceNode)}" kategorisi ${updatedCount} tesise kopyalandı ve kaydedildi.`, "success");
    } else {
      showNotification(`Bu kategori seçili tüm tesislerde zaten mevcut.`, "info");
    }
  };

  const handleAlignCategoryOrders = async () => {
    if (!benchmarkHotelId || !hotelsData[benchmarkHotelId]) return;

    const benchmarkTree = hotelsData[benchmarkHotelId];
    const benchmarkOrder = (benchmarkTree.children || []).map(c => getNodeKey(c));

    let updatedHotelsCount = 0;

    for (const hId of selectedHotelIds) {
      if (hId === benchmarkHotelId) continue;
      const targetTree = hotelsData[hId];
      if (!targetTree) continue;

      const currentChildren = [...(targetTree.children || [])];
      
      currentChildren.sort((a, b) => {
        const indexA = benchmarkOrder.indexOf(getNodeKey(a));
        const indexB = benchmarkOrder.indexOf(getNodeKey(b));
        
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      const updatedTree: HotelNode = {
        ...targetTree,
        children: currentChildren
      };

      await saveHotelTree(hId, updatedTree);
      updatedHotelsCount++;
    }

    showNotification(`${updatedHotelsCount} tesisin kategori sıralaması ${hotelsList.find(h => h.id === benchmarkHotelId)?.name || benchmarkHotelId} tesisine göre eşitlendi.`, "success");
  };

  // AUDIT REPORT ISSUES
  const auditIssues = useMemo<AuditIssue[]>(() => {
    const issues: AuditIssue[] = [];
    const activeHotels = selectedHotelIds.map(id => ({ id, data: hotelsData[id], summary: hotelsList.find(h => h.id === id) })).filter(h => h.data);
    if (activeHotels.length < 2) return [];

    const benchmarkData = hotelsData[benchmarkHotelId] || activeHotels[0].data;
    const benchmarkCategories = benchmarkData.children || [];

    benchmarkCategories.forEach(bCat => {
      const bKey = getNodeKey(bCat);
      const catName = getNodeName(bCat, 'tr');

      activeHotels.forEach(({ id, data, summary }) => {
        if (id === benchmarkHotelId) return;
        const targetCategories = data.children || [];
        const exists = targetCategories.some(c => getNodeKey(c) === bKey);

        if (!exists) {
          issues.push({
            id: `missing_cat_${id}_${bKey}`,
            type: 'missing_category',
            severity: 'high',
            title: `Eksik Ana Kategori: "${catName}"`,
            description: `"${catName}" kategorisi ${summary?.name || id} tesisinde bulunmuyor. Diğer tesislerde mevcut.`,
            targetHotelId: id,
            sourceHotelId: benchmarkHotelId,
            categoryName: catName,
            nodeData: bCat,
            fixAction: async () => {
              await handleCopyCategoryToHotel(bCat, id);
            }
          });
        }
      });
    });

    const benchmarkOrderKeys = benchmarkCategories.map(c => getNodeKey(c));
    activeHotels.forEach(({ id, data, summary }) => {
      if (id === benchmarkHotelId) return;
      const targetOrderKeys = (data.children || []).map(c => getNodeKey(c));
      
      const commonInBenchmark = benchmarkOrderKeys.filter(k => targetOrderKeys.includes(k));
      const commonInTarget = targetOrderKeys.filter(k => benchmarkOrderKeys.includes(k));

      if (JSON.stringify(commonInBenchmark) !== JSON.stringify(commonInTarget)) {
        issues.push({
          id: `order_mismatch_${id}`,
          type: 'order_mismatch',
          severity: 'medium',
          title: `Kategori Sıralaması Farklı: ${summary?.name || id}`,
          description: `Bu tesisin ana kategorilerinin dizilim sırası referans tesis ile uyuşmuyor. AI modelleri için standart sıra önerilir.`,
          targetHotelId: id,
          sourceHotelId: benchmarkHotelId,
          fixAction: async () => {
            await handleAlignCategoryOrders();
          }
        });
      }
    });

    benchmarkCategories.forEach(bCat => {
      const bKey = getNodeKey(bCat);
      const bSubCount = (bCat.children || []).length;
      const catName = getNodeName(bCat, 'tr');

      if (bSubCount > 0) {
        activeHotels.forEach(({ id, data, summary }) => {
          if (id === benchmarkHotelId) return;
          const targetCat = (data.children || []).find(c => getNodeKey(c) === bKey);
          if (targetCat) {
            const targetSubCount = (targetCat.children || []).length;
            if (targetSubCount !== bSubCount) {
              issues.push({
                id: `sub_count_${id}_${bKey}`,
                type: 'missing_subnode',
                severity: 'low',
                title: `Alt Düğüm Sayı Farkı: "${catName}"`,
                description: `${summary?.name || id} tesisinde bu kategoride ${targetSubCount} alt öge var. Referans tesiste ise ${bSubCount} öge tanımlı.`,
                targetHotelId: id,
                sourceHotelId: benchmarkHotelId,
                categoryName: catName,
                fixAction: async () => {
                  const updatedCat = JSON.parse(JSON.stringify(bCat));
                  const updatedTree = updateNodeInTree(data, targetCat.id, {
                    children: updatedCat.children
                  });
                  await saveHotelTree(id, updatedTree);
                  showNotification(`${summary?.name} tesisinin "${catName}" alt düğümleri güncellendi.`, "success");
                }
              });
            }
          }
        });
      }
    });

    return issues;
  }, [selectedHotelIds, hotelsData, benchmarkHotelId, hotelsList]);

  // Handle open node editor modal from comparison view
  const handleOpenNodeModal = (hotelId: string, node: HotelNode, parentNodeKey?: string) => {
    setEditingModalNode({ hotelId, node, parentNodeKey });
    setEditingNodeIdSlug(node.id);
    setEditingNodeType(node.type || 'category');
    setEditingTrName(getLocalizedValue(node.name, 'tr'));
    setEditingEnTrName(getLocalizedValue(node.name, 'en'));
    setEditingValTr(getLocalizedValue(node.value, 'tr'));
    setEditingValEn(getLocalizedValue(node.value, 'en'));
    setEditingIsShared(!!node.isShared);
    setEditingChildren(node.children ? JSON.parse(JSON.stringify(node.children)) : []);
    setApplyScope('single');
    setShowModalAddChild(false);
  };

  // Add child node in modal
  const handleModalAddChildSubmit = () => {
    if (!modalNewChildTr.trim()) return;
    const newChild: HotelNode = {
      id: modalNewChildId.trim() || generateSlug(modalNewChildTr),
      type: 'feature',
      name: { tr: modalNewChildTr.trim(), en: modalNewChildEn.trim() },
      value: { tr: '', en: '' }
    };
    setEditingChildren(prev => [...prev, newChild]);
    setModalNewChildTr('');
    setModalNewChildEn('');
    setModalNewChildId('');
    setShowModalAddChild(false);
  };

  // Remove child node in modal
  const handleModalRemoveChild = (childId: string) => {
    setEditingChildren(prev => prev.filter(c => c.id !== childId));
  };

  // Reorder child node in modal
  const handleModalReorderChild = (index: number, dir: 'up' | 'down') => {
    setEditingChildren(prev => {
      const arr = [...prev];
      const targetIdx = dir === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return arr;
      const temp = arr[index];
      arr[index] = arr[targetIdx];
      arr[targetIdx] = temp;
      return arr;
    });
  };

  // Save edited node back to hotel tree (single, selected, or all hotels)
  const handleSaveModalNode = async () => {
    if (!editingModalNode) return;
    const { hotelId, node } = editingModalNode;
    const nodeKey = getNodeKey(node);

    const targetHotelList = applyScope === 'all' 
      ? hotelsList.map(h => h.id) 
      : applyScope === 'selected' 
        ? selectedHotelIds 
        : [hotelId];

    let savedCount = 0;

    for (const hId of targetHotelList) {
      const currentTree = hotelsData[hId];
      if (!currentTree) continue;

      let updatedTree = currentTree;
      const targetNodeInTree = (currentTree.children || []).find(c => getNodeKey(c) === nodeKey) || findNodeById(currentTree, node.id);

      if (targetNodeInTree) {
        updatedTree = updateNodeInTree(currentTree, targetNodeInTree.id, {
          id: editingNodeIdSlug || targetNodeInTree.id,
          type: editingNodeType as any,
          name: { tr: editingTrName, en: editingEnTrName },
          value: { tr: editingValTr, en: editingValEn },
          isShared: editingIsShared,
          children: editingChildren
        });
      } else {
        const newNode: HotelNode = {
          id: editingNodeIdSlug || generateSlug(editingTrName),
          type: editingNodeType as any,
          name: { tr: editingTrName, en: editingEnTrName },
          value: { tr: editingValTr, en: editingValEn },
          isShared: editingIsShared,
          children: editingChildren
        };
        updatedTree = {
          ...currentTree,
          children: [...(currentTree.children || []), newNode]
        };
      }

      await saveHotelTree(hId, updatedTree);
      savedCount++;
    }

    setEditingModalNode(null);
    showNotification(`Düğüm ${savedCount} tesiste başarıyla kaydedildi ve senkronize edildi.`, "success");
  };

  // Open Transfer Modal ("Yok" cell click)
  const handleOpenTransferModal = (
    targetHotelId: string, 
    categoryKey: string, 
    trName: string, 
    enName: string, 
    isSubNode?: boolean,
    parentCategoryKey?: string
  ) => {
    setTransferModal({
      targetHotelId,
      categoryKey,
      trName,
      enName,
      isSubNode,
      parentCategoryKey
    });

    const sources = hotelsList.filter(h => h.id !== targetHotelId);
    if (sources.length > 0) {
      setSelectedSourceHotelId(sources[0].id);
    }
    setApplyToAllMissing(false);
  };

  // Confirm transfer from source hotel
  const handleConfirmTransfer = async () => {
    if (!transferModal) return;
    const { targetHotelId, categoryKey, trName, enName, isSubNode, parentCategoryKey } = transferModal;

    const sourceTree = selectedSourceHotelId ? hotelsData[selectedSourceHotelId] : null;
    let sourceNodeToCopy: HotelNode | null = null;

    if (sourceTree) {
      if (isSubNode && parentCategoryKey) {
        const parent = (sourceTree.children || []).find(c => getNodeKey(c) === parentCategoryKey);
        if (parent) {
          sourceNodeToCopy = (parent.children || []).find(sc => getNodeKey(sc) === categoryKey) || null;
        }
      } else {
        sourceNodeToCopy = (sourceTree.children || []).find(c => getNodeKey(c) === categoryKey) || null;
      }
    }

    const targetHotelsToProcess = applyToAllMissing 
      ? hotelsList.filter(h => {
          const tree = hotelsData[h.id];
          if (!tree) return false;
          if (isSubNode && parentCategoryKey) {
            const p = (tree.children || []).find(c => getNodeKey(c) === parentCategoryKey);
            return p ? !(p.children || []).some(sc => getNodeKey(sc) === categoryKey) : true;
          }
          return !(tree.children || []).some(c => getNodeKey(c) === categoryKey);
        }).map(h => h.id)
      : [targetHotelId];

    for (const tId of targetHotelsToProcess) {
      const tTree = hotelsData[tId];
      if (!tTree) continue;

      if (sourceNodeToCopy) {
        const cloned: HotelNode = JSON.parse(JSON.stringify(sourceNodeToCopy));
        cloned.id = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        if (isSubNode && parentCategoryKey) {
          let parentNode = (tTree.children || []).find(c => getNodeKey(c) === parentCategoryKey);
          if (!parentNode) {
            parentNode = {
              id: generateSlug(parentCategoryKey),
              type: 'category',
              name: { tr: parentCategoryKey, en: '' },
              children: []
            };
            tTree.children = [...(tTree.children || []), parentNode];
          }

          const updatedChildren = [...(parentNode.children || []), cloned];
          const updatedTree = updateNodeInTree(tTree, parentNode.id, { children: updatedChildren });
          await saveHotelTree(tId, updatedTree);
        } else {
          const updatedTree: HotelNode = {
            ...tTree,
            children: [...(tTree.children || []), cloned]
          };
          await saveHotelTree(tId, updatedTree);
        }
      } else {
        const blankNode: HotelNode = {
          id: generateSlug(trName),
          type: isSubNode ? 'feature' : 'category',
          name: { tr: trName, en: enName },
          value: { tr: '', en: '' }
        };

        if (isSubNode && parentCategoryKey) {
          let parentNode = (tTree.children || []).find(c => getNodeKey(c) === parentCategoryKey);
          if (!parentNode) {
            parentNode = {
              id: generateSlug(parentCategoryKey),
              type: 'category',
              name: { tr: parentCategoryKey, en: '' },
              children: []
            };
            tTree.children = [...(tTree.children || []), parentNode];
          }

          const updatedChildren = [...(parentNode.children || []), blankNode];
          const updatedTree = updateNodeInTree(tTree, parentNode.id, { children: updatedChildren });
          await saveHotelTree(tId, updatedTree);
        } else {
          const updatedTree: HotelNode = {
            ...tTree,
            children: [...(tTree.children || []), blankNode]
          };
          await saveHotelTree(tId, updatedTree);
        }
      }
    }

    setTransferModal(null);
    showNotification(`"${trName}" bilgisi ${targetHotelsToProcess.length} tesise aktarıldı ve oluşturuldu.`, "success");
  };

  // --- BULK MULTI-FACILITY EDITOR TAB HANDLERS ---
  const handleSelectBulkCategory = (catKey: string) => {
    setSelectedBulkCategoryKey(catKey);
    const row = categoryMatrix.find(r => r.key === catKey);
    if (!row) return;

    setBulkTrName(row.trName);
    setBulkEnName(row.enName);
    setBulkIdSlug(row.idSlug);
    setBulkNodeType(row.type || 'category');
    setBulkIsShared(row.isSharedAny);

    const subNodesList: { id: string; tr: string; en: string; type?: string }[] = [];
    if (row.subRows) {
      row.subRows.forEach(sr => {
        subNodesList.push({
          id: sr.idSlug,
          tr: sr.trName,
          en: sr.enName,
          type: sr.type
        });
      });
    }
    setBulkSubNodes(subNodesList);

    const descMap: Record<string, { tr: string; en: string }> = {};
    selectedHotelIds.forEach(hId => {
      const node = row.presentInHotels[hId];
      if (node) {
        descMap[hId] = {
          tr: getLocalizedValue(node.value, 'tr'),
          en: getLocalizedValue(node.value, 'en')
        };
      } else {
        descMap[hId] = { tr: '', en: '' };
      }
    });
    setBulkHotelDescriptions(descMap);
  };

  useEffect(() => {
    if (activeTab === 'bulk' && categoryMatrix.length > 0 && !selectedBulkCategoryKey) {
      handleSelectBulkCategory(categoryMatrix[0].key);
    }
  }, [activeTab, categoryMatrix]);

  const handleBulkAddSubNode = () => {
    if (!newBulkSubTr.trim()) return;
    const newSub = {
      id: newBulkSubId.trim() || generateSlug(newBulkSubTr),
      tr: newBulkSubTr.trim(),
      en: newBulkSubEn.trim(),
      type: 'feature'
    };
    setBulkSubNodes(prev => [...prev, newSub]);
    setNewBulkSubTr('');
    setNewBulkSubEn('');
    setNewBulkSubId('');
    setShowNewBulkSubForm(false);
  };

  const handleBulkReorderSubNode = (index: number, dir: 'up' | 'down') => {
    setBulkSubNodes(prev => {
      const arr = [...prev];
      const targetIdx = dir === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return arr;
      const temp = arr[index];
      arr[index] = arr[targetIdx];
      arr[targetIdx] = temp;
      return arr;
    });
  };

  const handleBulkDeleteSubNode = (index: number) => {
    setBulkSubNodes(prev => prev.filter((_, i) => i !== index));
  };

  // Save Bulk Category changes across all selected hotels
  const handleSaveBulkCategory = async () => {
    if (!selectedBulkCategoryKey || !bulkTrName.trim()) return;
    setIsBulkSaving(true);

    try {
      let savedHotelsCount = 0;

      for (const hId of selectedHotelIds) {
        const tree = hotelsData[hId];
        if (!tree) continue;

        let existingCatNode = (tree.children || []).find(c => getNodeKey(c) === selectedBulkCategoryKey);
        
        const childNodesStructure: HotelNode[] = bulkSubNodes.map(sn => {
          let existingSub = existingCatNode?.children?.find(c => getNodeKey(c) === sn.id || getNodeName(c, 'tr') === sn.tr);
          return {
            id: sn.id,
            type: (sn.type as any) || 'feature',
            name: { tr: sn.tr, en: sn.en },
            value: existingSub?.value || { tr: '', en: '' }
          };
        });

        const hotelVal = bulkHotelDescriptions[hId] || { tr: '', en: '' };

        if (existingCatNode) {
          const updatedTree = updateNodeInTree(tree, existingCatNode.id, {
            id: bulkIdSlug || existingCatNode.id,
            type: bulkNodeType as any,
            name: { tr: bulkTrName, en: bulkEnName },
            value: hotelVal,
            isShared: bulkIsShared,
            children: childNodesStructure
          });
          await saveHotelTree(hId, updatedTree);
        } else {
          const newCatNode: HotelNode = {
            id: bulkIdSlug || generateSlug(bulkTrName),
            type: bulkNodeType as any,
            name: { tr: bulkTrName, en: bulkEnName },
            value: hotelVal,
            isShared: bulkIsShared,
            children: childNodesStructure
          };
          const updatedTree = {
            ...tree,
            children: [...(tree.children || []), newCatNode]
          };
          await saveHotelTree(hId, updatedTree);
        }
        savedHotelsCount++;
      }

      showNotification(`"${bulkTrName}" kategorisi ${savedHotelsCount} tesiste toplu güncellendi ve senkronize edildi.`, "success");
    } catch (err) {
      console.error("Bulk save error", err);
      showNotification("Toplu güncelleme sırasında bir hata oluştu.", "error");
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Fill all hotel descriptions in bulk editor using benchmark hotel description
  const handleFillAllDescriptionsWithBenchmark = () => {
    const benchVal = bulkHotelDescriptions[benchmarkHotelId];
    if (!benchVal) return;

    const newMap = { ...bulkHotelDescriptions };
    selectedHotelIds.forEach(hId => {
      newMap[hId] = { ...benchVal };
    });
    setBulkHotelDescriptions(newMap);
    showNotification(`Tüm tesislerin içerikleri ${hotelsList.find(h => h.id === benchmarkHotelId)?.name || benchmarkHotelId} tesisinin verisiyle dolduruldu.`, "info");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-slate-50 rounded-2xl p-8 border border-slate-200">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Tüm Tesis Bilgi Tabanları Yükleniyor...</h3>
        <p className="text-sm text-slate-500 mt-1">6 otel tesisinin veri mimarisi analiz ediliyor ve kıyaslanıyor.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-6">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border animate-in slide-in-from-top-2 duration-200 ${
          notification.type === 'error' ? 'bg-red-600 text-white border-red-700' :
          notification.type === 'info' ? 'bg-indigo-600 text-white border-indigo-700' :
          'bg-emerald-600 text-white border-emerald-700'
        }`}>
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Tesis Karşılaştırma & Toplu Yapılandırma Merkezi
              </h2>
              <p className="text-xs text-slate-500">
                Tüm tesislerin kategorilerini hücre hücre inceleyin, kopyalayın, ya da tek tıkla toplu güncelleyin.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'matrix' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid size={14} />
            <span>Kategori Matrisi</span>
          </button>

          <button
            onClick={() => setActiveTab('sidebyside')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'sidebyside' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitCompare size={14} />
            <span>Yan Yana Kıyasla</span>
          </button>

          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'bulk' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Toplu Düzenleyici</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-black">YENİ</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'audit' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Uyum Raporu</span>
            {auditIssues.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
                {auditIssues.length}
              </span>
            )}
          </button>
        </div>

      </div>

      {/* FILTER & HOTEL SELECTION BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Kıyaslanacak Tesisler ({selectedHotelIds.length}/{hotelsList.length}):</span>
          </div>

          {/* Benchmark Hotel Dropdown */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>Referans Tesis (Benchmark):</span>
            <select
              value={benchmarkHotelId}
              onChange={(e) => setBenchmarkHotelId(e.target.value)}
              className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {hotelsList.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Hotel Checkbox Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {hotelsList.map(h => {
            const isSelected = selectedHotelIds.includes(h.id);
            const isBenchmark = h.id === benchmarkHotelId;

            return (
              <button
                key={h.id}
                onClick={() => handleToggleHotelSelection(h.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isSelected 
                    ? isBenchmark 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                      : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckSquare size={13} className={isSelected ? (isBenchmark ? 'text-amber-300' : 'text-indigo-600') : 'text-slate-300'} />
                <span>{h.name}</span>
                {isBenchmark && <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1 rounded-sm">BENCHMARK</span>}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kategori veya alt düğüm ara..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={diffOnly}
                onChange={(e) => setDiffOnly(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Sadece Farklılık / Eksiklik İçeren Satırları Göster</span>
            </label>

            {canEdit && (
              <button
                onClick={handleAlignCategoryOrders}
                disabled={!!savingHotelId}
                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200"
              >
                <ArrowUpDown size={13} />
                Sıralamayı Eşitle
              </button>
            )}
          </div>
        </div>

      </div>

      {/* TAB CONTENT */}
      <div>

        {/* TAB 1: CATEGORY MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  
                  {/* Header Row */}
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      <th className="p-4 min-w-[280px] sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        Kategori / Yapı Ögesi
                      </th>
                      {selectedHotelIds.map(hId => {
                        const hInfo = hotelsList.find(h => h.id === hId);
                        const isBenchmark = hId === benchmarkHotelId;
                        return (
                          <th key={hId} className={`p-4 min-w-[210px] border-r border-slate-200 text-center ${isBenchmark ? 'bg-indigo-50/50 text-indigo-900' : ''}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-xs truncate max-w-[180px]">{hInfo?.name || hId}</span>
                              {isBenchmark && (
                                <span className="text-[9px] text-indigo-700 font-extrabold uppercase tracking-tight bg-indigo-100 px-1.5 rounded">Referans Tesis</span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Body Rows */}
                  <tbody className="divide-y divide-slate-200 text-xs font-medium">
                    {categoryMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={selectedHotelIds.length + 1} className="p-12 text-center text-slate-400 font-semibold">
                          Arama kriterlerine uygun kategori bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      categoryMatrix.map((row) => {
                        const isExpanded = expandedRows[row.key];
                        const hasSubRows = row.subRows && row.subRows.length > 0;

                        return (
                          <React.Fragment key={row.key}>
                            {/* Main Category Row */}
                            <tr className="hover:bg-slate-50/80 transition-colors group">
                              
                              {/* Left Column: Category Name & Actions */}
                              <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {hasSubRows ? (
                                      <button
                                        onClick={() => setExpandedRows(prev => ({ ...prev, [row.key]: !prev[row.key] }))}
                                        className="p-1 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                                      >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                    ) : (
                                      <div className="w-5" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 truncate text-xs flex items-center gap-1.5">
                                        <span>{row.trName}</span>
                                        {row.isSharedAny && (
                                          <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-extrabold shrink-0">
                                            Ortak Bilgi
                                          </span>
                                        )}
                                      </div>
                                      {row.enName && (
                                        <div className="text-[11px] text-slate-400 truncate">{row.enName}</div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Row Propagation Action */}
                                  {canEdit && (
                                    <button
                                      onClick={() => {
                                        const validNode = (Object.values(row.presentInHotels) as (HotelNode | null)[]).find((n): n is HotelNode => n !== null);
                                        if (validNode) handlePropagateCategoryToAllHotels(validNode);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                      title="Bu kategoriyi tüm eksik otellere kopyala"
                                    >
                                      <Copy size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Hotel Columns Interactive Cells */}
                              {selectedHotelIds.map(hId => {
                                const node = row.presentInHotels[hId];
                                const isPresent = !!node;
                                const childCount = node?.children?.length || 0;

                                return (
                                  <td key={hId} className="p-3 border-r border-slate-200 text-center align-middle">
                                    {isPresent ? (
                                      <button
                                        onClick={() => handleOpenNodeModal(hId, node)}
                                        className="w-full inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 transition-all cursor-pointer group/cell"
                                      >
                                        <div className="inline-flex items-center gap-1 text-emerald-800 font-bold text-[11px]">
                                          <CheckCircle2 size={13} className="text-emerald-600" />
                                          <span>Mevcut ({childCount} öge)</span>
                                        </div>
                                        <span className="text-[10px] text-emerald-700 font-semibold group-hover/cell:underline flex items-center gap-0.5">
                                          <Eye size={10} /> İncele / Düzenle
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenTransferModal(hId, row.key, row.trName, row.enName, false)}
                                        className="w-full inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-red-50/60 hover:bg-red-100/80 border border-red-200 transition-all cursor-pointer group/cell"
                                      >
                                        <div className="inline-flex items-center gap-1 text-red-700 font-bold text-[11px]">
                                          <XCircle size={13} className="text-red-500" />
                                          <span>Eksik Kategori</span>
                                        </div>
                                        {canEdit && (
                                          <span className="text-[10px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded shadow-xs group-hover/cell:bg-indigo-600 group-hover/cell:text-white transition-colors">
                                            + Aktar / Ekle
                                          </span>
                                        )}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}

                            </tr>

                            {/* Sub-rows (Expanded) */}
                            {isExpanded && row.subRows?.map(subRow => (
                              <tr key={subRow.key} className="bg-slate-50/50 hover:bg-slate-100/60 transition-colors text-xs">
                                <td className="py-2.5 pl-10 pr-4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                                  <div className="font-medium text-slate-700 truncate flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                                    <span>{subRow.trName}</span>
                                    {subRow.enName && <span className="text-[10px] text-slate-400">({subRow.enName})</span>}
                                  </div>
                                </td>

                                {selectedHotelIds.map(hId => {
                                  const subNode = subRow.presentInHotels[hId];
                                  const isSubPresent = !!subNode;

                                  return (
                                    <td key={hId} className="py-2 px-3 border-r border-slate-200 text-center">
                                      {isSubPresent ? (
                                        <button
                                          onClick={() => handleOpenNodeModal(hId, subNode, row.key)}
                                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-indigo-700 font-bold text-[11px] hover:underline bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                                        >
                                          <Check size={12} /> Var (Düzenle)
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleOpenTransferModal(hId, subRow.idSlug, subRow.trName, subRow.enName, true, row.key)}
                                          className="text-red-500 hover:text-indigo-600 font-bold text-[11px] bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded border border-red-200 transition-colors"
                                        >
                                          Yok (+ Ekle)
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}

                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>

                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: SIDE BY SIDE EXPLORER */}
        {activeTab === 'sidebyside' && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Sol Tesis (A):</label>
                <select
                  value={sideHotelA}
                  onChange={(e) => setSideHotelA(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {hotelsList.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Sağ Tesis (B):</label>
                <select
                  value={sideHotelB}
                  onChange={(e) => setSideHotelB(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {hotelsList.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Hotel A Panel */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                <div className="bg-indigo-50/60 p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-indigo-600" size={18} />
                    <h3 className="font-bold text-sm text-slate-900">
                      {hotelsList.find(h => h.id === sideHotelA)?.name || sideHotelA}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">
                    {(hotelsData[sideHotelA]?.children || []).length} Ana Kategori
                  </span>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {(hotelsData[sideHotelA]?.children || []).map(node => {
                    const nodeKey = getNodeKey(node);
                    const matchingInB = (hotelsData[sideHotelB]?.children || []).find(c => getNodeKey(c) === nodeKey);
                    
                    return (
                      <div 
                        key={node.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          matchingInB 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-red-50/40 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-900">
                            {getNodeName(node, 'tr')}
                          </div>
                          {canEdit && !matchingInB && (
                            <button
                              onClick={() => handleCopyCategoryToHotel(node, sideHotelB)}
                              className="text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            >
                              Sağ Otele Aktar <ArrowRight size={11} />
                            </button>
                          )}
                        </div>

                        {node.children && node.children.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                            {node.children.map(child => (
                              <span key={child.id} className="text-[10px] bg-white border border-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                                {getNodeName(child, 'tr')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hotel B Panel */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                <div className="bg-indigo-50/60 p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-indigo-600" size={18} />
                    <h3 className="font-bold text-sm text-slate-900">
                      {hotelsList.find(h => h.id === sideHotelB)?.name || sideHotelB}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">
                    {(hotelsData[sideHotelB]?.children || []).length} Ana Kategori
                  </span>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {(hotelsData[sideHotelB]?.children || []).map(node => {
                    const nodeKey = getNodeKey(node);
                    const matchingInA = (hotelsData[sideHotelA]?.children || []).find(c => getNodeKey(c) === nodeKey);
                    
                    return (
                      <div 
                        key={node.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          matchingInA 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-red-50/40 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-900">
                            {getNodeName(node, 'tr')}
                          </div>
                          {canEdit && !matchingInA && (
                            <button
                              onClick={() => handleCopyCategoryToHotel(node, sideHotelA)}
                              className="text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            >
                              Sol Otele Aktar <ArrowRight size={11} className="rotate-180" />
                            </button>
                          )}
                        </div>

                        {node.children && node.children.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                            {node.children.map(child => (
                              <span key={child.id} className="text-[10px] bg-white border border-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                                {getNodeName(child, 'tr')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: BULK MULTI-FACILITY EDITOR */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold flex items-center gap-2">
                    <Sparkles className="text-amber-400" size={18} />
                    Toplu & Çoklu Tesis Yönetim Modu
                  </h3>
                  <p className="text-xs text-indigo-200 max-w-3xl leading-relaxed">
                    Aşağıdan bir kategori seçin. Tüm seçili tesislerdeki ortak başlıkları, ID/Slug'ları, alt menü ögesi sıralamalarını ve Türkçe/İngilizce içerikleri eşzamanlı olarak tek ekrandan düzenleyin ve senkronize edin.
                  </p>
                </div>

                <button
                  onClick={handleSaveBulkCategory}
                  disabled={isBulkSaving || !canEdit}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isBulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Tüm Tesislerde Kaydet & Senkronize Et</span>
                </button>
              </div>
            </div>

            {/* Category Selector Pills */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <label className="text-xs font-extrabold text-slate-800 block uppercase tracking-wider">
                Düzenlenecek Ana Kategori Seçin:
              </label>
              <div className="flex flex-wrap gap-2">
                {categoryMatrix.map(row => {
                  const isSelected = row.key === selectedBulkCategoryKey;
                  return (
                    <button
                      key={row.key}
                      onClick={() => handleSelectBulkCategory(row.key)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{row.trName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {row.subRows?.length || 0} alt öge
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bulk Category Editor Panels */}
            {selectedBulkCategoryKey && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Panel: Global Category Settings & Sub-nodes Manager */}
                <div className="lg:col-span-6 space-y-6">
                  
                  {/* Category Properties Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Sliders size={16} className="text-indigo-600" />
                      1. Ortak Kategori Özellikleri (Tüm Tesisler İçin)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                      <div>
                        <label className="block text-slate-600 mb-1">Türkçe Kategori Adı:</label>
                        <input
                          type="text"
                          value={bulkTrName}
                          onChange={(e) => setBulkTrName(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">İngilizce Kategori Adı (EN):</label>
                        <input
                          type="text"
                          value={bulkEnName}
                          onChange={(e) => setBulkEnName(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Kategori ID / Slug:</label>
                        <input
                          type="text"
                          value={bulkIdSlug}
                          onChange={(e) => setBulkIdSlug(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Düğüm Tipi:</label>
                        <select
                          value={bulkNodeType}
                          onChange={(e) => setBulkNodeType(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-bold text-slate-900 focus:bg-white"
                        >
                          <option value="category">Category (Kategori)</option>
                          <option value="feature">Feature (Özellik)</option>
                          <option value="list">List (Liste)</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100">
                      <input
                        type="checkbox"
                        checked={bulkIsShared}
                        onChange={(e) => setBulkIsShared(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="text-xs text-slate-800 font-bold">Tüm Tesisler İçin Ortak Bilgi Olarak İşaretle</span>
                    </label>
                  </div>

                  {/* Sub-Nodes Manager Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600" />
                        2. Alt Menü Ögeleri & Sıralama ({bulkSubNodes.length})
                      </h4>

                      <button
                        onClick={() => setShowNewBulkSubForm(prev => !prev)}
                        className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                      >
                        <PlusCircle size={14} /> Toplu Alt Öge Ekle
                      </button>
                    </div>

                    {/* Add New Sub-node form */}
                    {showNewBulkSubForm && (
                      <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-3 animate-in fade-in duration-150">
                        <h5 className="font-bold text-xs text-indigo-950">Tüm Tesislerde Yeni Alt Öge Tanımla</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Türkçe Adı (örn: Açık Isıtmalı Havuz)"
                            value={newBulkSubTr}
                            onChange={(e) => setNewBulkSubTr(e.target.value)}
                            className="text-xs p-2.5 border border-indigo-200 rounded-lg bg-white font-semibold"
                          />
                          <input
                            type="text"
                            placeholder="İngilizce Adı (EN)"
                            value={newBulkSubEn}
                            onChange={(e) => setNewBulkSubEn(e.target.value)}
                            className="text-xs p-2.5 border border-indigo-200 rounded-lg bg-white font-medium"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setShowNewBulkSubForm(false)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handleBulkAddSubNode}
                            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm"
                          >
                            Ekle
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sub-nodes list with reorder controls */}
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {bulkSubNodes.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-6">Bu kategoride henüz alt menü ögesi bulunmuyor.</p>
                      ) : (
                        bulkSubNodes.map((sub, index) => (
                          <div key={sub.id || index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 group hover:border-indigo-200 transition-colors">
                            
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Reorder Arrows */}
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => handleBulkReorderSubNode(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-slate-200 text-slate-600 rounded disabled:opacity-20"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  onClick={() => handleBulkReorderSubNode(index, 'down')}
                                  disabled={index === bulkSubNodes.length - 1}
                                  className="p-1 hover:bg-slate-200 text-slate-600 rounded disabled:opacity-20"
                                >
                                  <ArrowDown size={11} />
                                </button>
                              </div>

                              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={sub.tr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkSubNodes(prev => prev.map((item, i) => i === index ? { ...item, tr: val } : item));
                                  }}
                                  className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg p-1.5"
                                />
                                <input
                                  type="text"
                                  value={sub.en}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkSubNodes(prev => prev.map((item, i) => i === index ? { ...item, en: val } : item));
                                  }}
                                  placeholder="EN adı"
                                  className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => handleBulkDeleteSubNode(index)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Tüm tesislerden çıkar"
                            >
                              <Trash2 size={14} />
                            </button>

                          </div>
                        ))
                      )}
                    </div>

                  </div>

                </div>

                {/* Right Panel: Per-Hotel Description & Value Matrix */}
                <div className="lg:col-span-6 space-y-6">
                  
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <Building2 size={16} className="text-indigo-600" />
                          3. Tesis Bazlı İçerik & Açıklamalar
                        </h4>
                        <p className="text-[11px] text-slate-500">Her bir tesisin bu kategoriye özel metin ve detaylarını yan yana düzenleyin.</p>
                      </div>

                      <button
                        onClick={handleFillAllDescriptionsWithBenchmark}
                        className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shrink-0"
                      >
                        <Zap size={13} /> Benchmark İçeriğiyle Doldur
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                      {selectedHotelIds.map(hId => {
                        const hInfo = hotelsList.find(h => h.id === hId);
                        const isBenchmark = hId === benchmarkHotelId;
                        const desc = bulkHotelDescriptions[hId] || { tr: '', en: '' };

                        return (
                          <div key={hId} className={`p-4 rounded-xl border transition-all ${
                            isBenchmark ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                                <Building2 size={14} className="text-indigo-600" />
                                {hInfo?.name || hId}
                              </span>
                              {isBenchmark && (
                                <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded">REFERANS</span>
                              )}
                            </div>

                            <div className="space-y-2 text-xs">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Açıklama (TR):</label>
                                <textarea
                                  rows={2}
                                  value={desc.tr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkHotelDescriptions(prev => ({
                                      ...prev,
                                      [hId]: { ...prev[hId], tr: val }
                                    }));
                                  }}
                                  placeholder="Tesisin bu kategoriye özel bilgisi..."
                                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Açıklama (EN):</label>
                                <textarea
                                  rows={2}
                                  value={desc.en}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkHotelDescriptions(prev => ({
                                      ...prev,
                                      [hId]: { ...prev[hId], en: val }
                                    }));
                                  }}
                                  placeholder="English content..."
                                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 4: AUDIT REPORT */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="text-amber-400" size={20} />
                    Otomatik Bilgi Tabanı Uyum & Tutarlılık Raporu
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Sistemdeki tüm otellerin veri mimarisi çapraz kontrolden geçirildi. Aşağıdaki uyumsuzlukları tek tıkla otomatize şekilde giderebilirsiniz.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl text-center">
                    <div className="text-xl font-extrabold text-amber-400">{auditIssues.length}</div>
                    <div className="text-[10px] text-slate-300 font-semibold uppercase">Tespit Edilen Fark</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {auditIssues.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-8 rounded-2xl text-center space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-base">Tüm Tesisler Mükemmel Şekilde Uyumlu!</h4>
                  <p className="text-xs text-emerald-700">Seçili tesisler arasında hiçbir kategori eksikliği veya sıralama tutarsızlığı bulunmadı.</p>
                </div>
              ) : (
                auditIssues.map(issue => (
                  <div key={issue.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <AlertTriangle size={20} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{issue.title}</h4>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                            issue.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {issue.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{issue.description}</p>
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => issue.fixAction()}
                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap size={14} />
                        Hemen Düzelt / Kopyala
                      </button>
                    )}

                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </div>

      {/* NODE DETAILS & EDITOR MODAL */}
      {editingModalNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Düğüm Detayı & Yapılandırma</h3>
                  <p className="text-[11px] text-slate-500">
                    Tesis: <strong className="text-indigo-700">{hotelsList.find(h => h.id === editingModalNode.hotelId)?.name || editingModalNode.hotelId}</strong>
                  </p>
                </div>
              </div>

              <button onClick={() => setEditingModalNode(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs font-semibold text-slate-700">
              
              {/* Properties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Türkçe Başlık (TR):</label>
                  <input
                    type="text"
                    value={editingTrName}
                    onChange={(e) => setEditingTrName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">İngilizce Başlık (EN):</label>
                  <input
                    type="text"
                    value={editingEnTrName}
                    onChange={(e) => setEditingEnTrName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Düğüm ID / Slug:</label>
                  <input
                    type="text"
                    value={editingNodeIdSlug}
                    onChange={(e) => setEditingNodeIdSlug(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Düğüm Tipi:</label>
                  <select
                    value={editingNodeType}
                    onChange={(e) => setEditingNodeType(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white font-bold text-slate-800"
                  >
                    <option value="category">Category (Ana Kategori)</option>
                    <option value="feature">Feature (Özellik)</option>
                    <option value="text">Text (Metin/Açıklama)</option>
                    <option value="list">List (Liste)</option>
                  </select>
                </div>
              </div>

              {/* Description Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Açıklama / İçerik (TR):</label>
                  <textarea
                    rows={3}
                    value={editingValTr}
                    onChange={(e) => setEditingValTr(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-bold">Açıklama / İçerik (EN):</label>
                  <textarea
                    rows={3}
                    value={editingValEn}
                    onChange={(e) => setEditingValEn(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Shared Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editingIsShared}
                  onChange={(e) => setEditingIsShared(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="text-slate-800 font-bold">Ortak Bilgi Olarak İşaretle (Tüm Tesislerde Aynı Tutulur)</span>
              </label>

              {/* Sub-nodes Section */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-600" />
                    Alt Düğümler / Menü Ögeleri ({editingChildren.length})
                  </span>

                  {canEdit && (
                    <button
                      onClick={() => setShowModalAddChild(prev => !prev)}
                      className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-all"
                    >
                      + Alt Öge Ekle
                    </button>
                  )}
                </div>

                {showModalAddChild && (
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="TR Başlık"
                        value={modalNewChildTr}
                        onChange={(e) => setModalNewChildTr(e.target.value)}
                        className="text-xs p-2 border border-indigo-200 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        placeholder="EN Başlık"
                        value={modalNewChildEn}
                        onChange={(e) => setModalNewChildEn(e.target.value)}
                        className="text-xs p-2 border border-indigo-200 rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowModalAddChild(false)} className="px-2.5 py-1 text-xs text-slate-600">İptal</button>
                      <button onClick={handleModalAddChildSubmit} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold">Ekle</button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {editingChildren.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Alt düğüm yok.</p>
                  ) : (
                    editingChildren.map((child, idx) => (
                      <div key={child.id || idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button onClick={() => handleModalReorderChild(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowUp size={11} /></button>
                          <button onClick={() => handleModalReorderChild(idx, 'down')} disabled={idx === editingChildren.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowDown size={11} /></button>
                          <span className="font-bold text-slate-800 truncate">{getNodeName(child, 'tr')}</span>
                          {child.name?.en && <span className="text-[10px] text-slate-400 truncate">({child.name.en})</span>}
                        </div>
                        {canEdit && (
                          <button onClick={() => handleModalRemoveChild(child.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Multi-Facility Save Scope Option */}
              {canEdit && (
                <div className="border-t border-slate-100 pt-4 space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                  <span className="font-extrabold text-xs text-indigo-950 block uppercase tracking-wider">
                    Uygulama Kapsamı (Toplu Güncelleme):
                  </span>
                  
                  <div className="space-y-1.5 text-xs font-bold text-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="applyScope"
                        checked={applyScope === 'single'}
                        onChange={() => setApplyScope('single')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Yalnızca Bu Tesis ({hotelsList.find(h => h.id === editingModalNode.hotelId)?.name || editingModalNode.hotelId})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="applyScope"
                        checked={applyScope === 'selected'}
                        onChange={() => setApplyScope('selected')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Seçili Tüm Tesislerde Güncelle ({selectedHotelIds.length} Tesis)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="applyScope"
                        checked={applyScope === 'all'}
                        onChange={() => setApplyScope('all')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Tüm Tesislerde Eşitle ({hotelsList.length} Tesis)</span>
                    </label>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingModalNode(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700"
              >
                Vazgeç
              </button>

              {canEdit && (
                <button
                  onClick={handleSaveModalNode}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save size={14} />
                  <span>Kaydet ve Senkronize Et</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TRANSFER / COPY MODAL ("Yok" Cell Click) */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <Copy size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Tesis Bilgisi Aktar & Oluştur</h3>
                  <p className="text-[11px] text-slate-500">
                    Hedef Tesis: <strong className="text-indigo-700">{hotelsList.find(h => h.id === transferModal.targetHotelId)?.name || transferModal.targetHotelId}</strong>
                  </p>
                </div>
              </div>

              <button onClick={() => setTransferModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <span className="font-extrabold text-xs block">Eksik Bilgi: "{transferModal.trName}"</span>
                <p className="text-[11px] text-amber-800">
                  Bu bilgi hedef tesisinde henüz tanımlı değil. Başka bir tesisteki içeriği birebir kopyalayabilir veya boş şablon olarak ekleyebilirsiniz.
                </p>
              </div>

              {/* Source Hotel Selection */}
              <div className="space-y-1.5">
                <label className="block text-slate-800 font-bold">Kopyalanacak Kaynak Tesis Seçin:</label>
                <select
                  value={selectedSourceHotelId}
                  onChange={(e) => setSelectedSourceHotelId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-bold text-slate-900 focus:bg-white"
                >
                  <option value="">-- Boş Şablon Olarak Oluştur --</option>
                  {hotelsList.filter(h => h.id !== transferModal.targetHotelId).map(h => (
                    <option key={h.id} value={h.id}>{h.name} Tesisinden Kopyala</option>
                  ))}
                </select>
              </div>

              {/* Apply to all missing check */}
              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={applyToAllMissing}
                  onChange={(e) => setApplyToAllMissing(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="text-slate-800 font-bold">Bu Bilgiyi Tüm Eksik Tesislerde Birden Oluştur</span>
              </label>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Zap size={14} />
                <span>Aktar ve Oluştur</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ComparisonView;

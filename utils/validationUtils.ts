
import { HotelNode, HealthIssue, IssueSeverity, LocalizedText } from '../types';
import { generateId } from './treeUtils';

// Helper to handle localized text safely
const getText = (val: LocalizedText | string | undefined): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.tr || val.en || '';
};

/**
 * Validates a single node's input before UI updates to prevent bad patterns.
 * Returns an error string if invalid, or null if valid.
 */
export const validateNodeInput = (node: HotelNode): string | null => {
  // KURAL 1: Kategori/Liste/Menu tiplerinde uzun "Value" (açıklama) olmamalı
  if (['category', 'list', 'menu', 'root'].includes(String(node.type))) {
     const val = getText(node.value);
     if (val && val.length > 50 && !val.includes('http')) { 
        return "Kategoriler veya Listeler için 'Ana Değer' alanı kısa tutulmalı veya boş bırakılmalıdır. Detaylar için açıklama veya alt öğe kullanın.";
     }
  }

  // KURAL 2: Yapısal Bütünlük (Leaf node'ların çocuğu olamaz)
  if (node.children && node.children.length > 0) {
      if (['item', 'field', 'menu_item', 'qa_pair'].includes(String(node.type))) {
          return "Bu öğenin alt öğeleri var. Tipi 'Öğe' (Item) yerine 'Kategori' veya 'Liste' olmalı.";
      }
  }

  return null;
};

/**
 * Runs all local validation rules and combines the results.
 */
export const runLocalValidation = (root: HotelNode): HealthIssue[] => {
  const issues: HealthIssue[] = [];
  
  // Referans kontrolleri için tanımlı terimleri topla
  const definedTerms = new Set<string>();
  const collectDefinitions = (node: HotelNode) => {
      const name = getText(node.name).trim();
      if (['list', 'menu', 'policy', 'category'].includes(String(node.type)) && name) {
          definedTerms.add(name);
      }
      node.children?.forEach(collectDefinitions);
  };
  collectDefinitions(root);

  // 1. Boş/Eksik Veri Kontrolü
  issues.push(...findEmptyNodes(root));

  // 2. Yapısal Derinlik ve Mantık
  issues.push(...findStructuralIssues(root));

  // 3. Tekrarlanan Kardeş Öğeler
  issues.push(...findDuplicateSiblings(root));

  // 4. Semantik Tutarlılık (Yeni: Intent vs Konum)
  issues.push(...findSemanticMismatches(root));

  // 5. Eksik Hizmet Detayları (Saat, Konum vb.)
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
  nodeName: getText(node.name) || 'İsimsiz Öğe',
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
  const name = getText(node.name);
  if (!name || name.trim() === '') {
    issues.push(createIssue(node, 'critical', 'Öğenin bir ismi yok.', 'İsim Ata', { name: 'Yeni Öğe' }));
  } else if (['new item', 'untitled', 'isimsiz', 'yeni öğe'].some(s => name.toLowerCase().includes(s))) {
    issues.push(createIssue(node, 'warning', 'Öğe varsayılan (placeholder) isme sahip.', 'Yeniden Adlandır', {}));
  }

  // Değer Kontrolü (Sadece Leaf Node'lar için)
  if (['item', 'field'].includes(String(node.type))) {
    // Eğer şeması yoksa ve değeri boşsa
    if (!node.schemaType || node.schemaType === 'generic') {
        const val = getText(node.value);
        if ((!val || val.trim() === '') && (!node.attributes || node.attributes.length === 0)) {
            issues.push(createIssue(node, 'warning', `"${name}" alanı boş görünüyor.`, 'Yer Tutucu Ekle', { value: 'Detaylar eklenecek.' }));
        }
    }
  }

  if (node.type === 'menu_item') {
    if (!node.price && node.price !== 0) {
      issues.push(createIssue(node, 'warning', `Menü öğesi "${name}" için fiyat girilmemiş.`, 'Fiyat Ata', { price: 0 }));
    }
  }

  if (node.type === 'qa_pair') {
    const ans = getText(node.answer);
    if (!ans || ans.trim() === '') {
      issues.push(createIssue(node, 'critical', `"${node.question || 'Bilinmeyen'}" sorusunun cevabı yok.`, 'Cevap Ata', { answer: 'Bu konuda bilgi resepsiyondan alınabilir.' }));
    }
  }

  if (node.children) {
    node.children.forEach(child => findEmptyNodes(child, issues));
  }

  return issues;
};

const findStructuralIssues = (node: HotelNode, depth: number = 0, issues: HealthIssue[] = []): HealthIssue[] => {
  if (depth > 6) {
    issues.push(createIssue(node, 'optimization', `İç içe klasör derinliği (${depth}) kullanıcı deneyimi için çok fazla.`, undefined));
  }

  // Alt öğesi olan 'field' veya 'item' uyarısı
  if (['field', 'item', 'menu_item', 'qa_pair'].includes(String(node.type)) && node.children && node.children.length > 0) {
    issues.push(createIssue(node, 'critical', `"${getText(node.name)}" bir '${node.type}' ama alt öğeleri var.`, 'Kategoriye Çevir', { type: 'category' }));
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
      const name = getText(child.name).trim().toLowerCase();
      if (name) {
        nameMap.set(name, (nameMap.get(name) || 0) + 1);
      }
    });

    node.children.forEach(child => {
      const name = getText(child.name).trim().toLowerCase();
      if (nameMap.get(name)! > 1) {
        const childName = getText(child.name);
        issues.push(createIssue(child, 'warning', `Aynı kategoride "${childName}" isminde birden fazla öğe var.`, 'Yeniden Adlandır', { name: `${childName} (Kopya)` }));
      }
    });
    
    node.children.forEach(child => findDuplicateSiblings(child, issues));
  }

  return issues;
};

const findSemanticMismatches = (node: HotelNode, parentCategoryName: string = '', issues: HealthIssue[] = []): HealthIssue[] => {
    
    const nodeName = getText(node.name).toLowerCase();
    const parentName = parentCategoryName.toLowerCase();
    const intent = node.intent || 'informational'; // Default intent

    // Rule 1: 'Policy' intent found in general/info categories without 'rule' keywords
    if (intent === 'policy') {
        const isInPolicyCategory = parentName.includes('rule') || parentName.includes('kural') || parentName.includes('politik') || parentName.includes('yasak');
        if (parentName && !isInPolicyCategory && (parentName.includes('bilgi') || parentName.includes('info'))) {
            issues.push(createIssue(
                node,
                'warning',
                `"${getText(node.name)}" bir KURAL (Policy) ancak "Bilgi" kategorisinde duruyor.`,
                'Niyeti Değiştir',
                { intent: 'informational' }
            ));
        }
    }

    // Rule 2: 'Safety' intent items should not be buried deep or obscure
    if (intent === 'safety' && !parentName.includes('safety') && !parentName.includes('güvenlik') && !parentName.includes('acil')) {
         issues.push(createIssue(
                node,
                'optimization',
                `"${getText(node.name)}" bir GÜVENLİK öğesi. "Acil Durum" veya "Güvenlik" kategorisinde olması daha doğru olur.`,
                undefined
            ));
    }

    // Rule 3: Complaint/Request items in generic lists
    if ((intent === 'complaint' || intent === 'request') && parentName.includes('genel')) {
        issues.push(createIssue(
            node,
            'optimization',
            `"${getText(node.name)}" bir talep/şikayet konusu. Operasyonel bir kategoriye (Örn: Oda Servisi, Teknik Servis) taşınması önerilir.`,
            undefined
        ));
    }

    // Rule 4: Intent missing on critical items (policy type nodes)
    if (node.type === 'policy' && (!node.intent || node.intent === 'informational')) {
         issues.push(createIssue(
            node,
            'warning',
            `Bu öğe bir Politika tipi ancak niyeti 'Policy' olarak işaretlenmemiş.`,
            'Niyeti Düzelt',
            { intent: 'policy' }
        ));
    }

    if (node.children) {
        node.children.forEach(c => findSemanticMismatches(c, getText(node.name) || '', issues));
    }
    return issues;
}

const findMissingServiceDetails = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
    // SADECE FİZİKSEL HİZMETLERİ TARA (QA, Not, Politika HARİÇ)
    if (['qa_pair', 'note', 'policy', 'field'].includes(String(node.type))) return issues;

    const name = getText(node.name).toLowerCase();
    const isService = name.includes('restoran') || 
                      name.includes('bar') ||
                      name.includes('pool') ||
                      name.includes('havuz') ||
                      name.includes('spa') ||
                      name.includes('club');
    
    // Eğer bir hizmetse (item veya category olabilir) ve alt öğesi yoksa
    // Veya category ise ama içinde 'saat', 'time', 'open' geçen bir şey yoksa
    if (isService) {
        const hasTime = node.attributes?.some(a => a.key.toLowerCase().includes('saat') || a.key.toLowerCase().includes('açılış') || a.key.toLowerCase().includes('kapanış'));
        const hasLocation = node.attributes?.some(a => a.key.toLowerCase().includes('konum') || a.key.toLowerCase().includes('yer'));
        
        // Veri şeması (dining/event) doluysa sorun yok
        if (node.data && (node.data.shifts || node.data.schedule)) return issues;

        // Metin içinde saat geçiyor mu?
        const textContent = getText(node.value).toLowerCase();
        const hasTimeInText = textContent.includes(':') && /\d/.test(textContent); // Basit saat kontrolü örn: 10:00

        if (!hasTime && !hasTimeInText && !hasLocation && !node.children?.length) {
             issues.push(createIssue(
                 node, 
                 'optimization', 
                 `"${getText(node.name)}" önemli bir hizmet ancak saat veya konum bilgisi eksik görünüyor.`, 
                 'Saat Bilgisi Ekle', 
                 // Fix Payload: Mevcut attributelara ekleme yap
                 { attributes: [...(node.attributes || []), { id: `attr_${Date.now()}`, key: 'Çalışma Saatleri', value: '09:00 - 18:00', type: 'text' }] }
             ));
        }
    }

    if (node.children) {
        node.children.forEach(c => findMissingServiceDetails(c, issues));
    }
    return issues;
}

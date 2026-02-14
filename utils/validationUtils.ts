
import { HotelNode, HealthIssue, IssueSeverity } from '../types';
import { generateId } from './treeUtils';

/**
 * Validates a single node's input before UI updates to prevent bad patterns.
 * Returns an error string if invalid, or null if valid.
 */
export const validateNodeInput = (node: HotelNode): string | null => {
  // KURAL 1: Kategori/Liste/Menu tiplerinde uzun "Value" (açıklama) olmamalı
  if (['category', 'list', 'menu', 'root'].includes(String(node.type))) {
     if (node.value && node.value.length > 50 && !node.value.includes('http')) { 
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
      if (['list', 'menu', 'policy', 'category'].includes(String(node.type)) && node.name) {
          definedTerms.add(node.name.trim());
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

  // 4. İlişkisel Bütünlük (Kırık Linkler - Basit)
  issues.push(...findBrokenReferences(root, definedTerms));

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
  nodeName: node.name || 'İsimsiz Öğe',
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
    issues.push(createIssue(node, 'critical', 'Öğenin bir ismi yok.', 'İsim Ata', { name: 'Yeni Öğe' }));
  } else if (['new item', 'untitled', 'isimsiz', 'yeni öğe'].some(s => node.name?.toLowerCase().includes(s))) {
    issues.push(createIssue(node, 'warning', 'Öğe varsayılan (placeholder) isme sahip.', 'Yeniden Adlandır', {}));
  }

  // Değer Kontrolü (Sadece Leaf Node'lar için)
  if (['item', 'field'].includes(String(node.type))) {
    // Eğer şeması yoksa ve değeri boşsa
    if (!node.schemaType || node.schemaType === 'generic') {
        if ((!node.value || node.value.trim() === '') && (!node.attributes || node.attributes.length === 0)) {
            issues.push(createIssue(node, 'warning', `"${node.name}" alanı boş görünüyor.`, 'Yer Tutucu Ekle', { value: 'Detaylar eklenecek.' }));
        }
    }
  }

  if (node.type === 'menu_item') {
    if (!node.price && node.price !== 0) {
      issues.push(createIssue(node, 'warning', `Menü öğesi "${node.name}" için fiyat girilmemiş.`, 'Fiyat Ata', { price: 0 }));
    }
  }

  if (node.type === 'qa_pair') {
    if (!node.answer || node.answer.trim() === '') {
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
    issues.push(createIssue(node, 'critical', `"${node.name}" bir '${node.type}' ama alt öğeleri var.`, 'Kategoriye Çevir', { type: 'category' }));
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
        issues.push(createIssue(child, 'warning', `Aynı kategoride "${child.name}" isminde birden fazla öğe var.`, 'Yeniden Adlandır', { name: `${child.name} (Kopya)` }));
      }
    });
    
    node.children.forEach(child => findDuplicateSiblings(child, issues));
  }

  return issues;
};

const findBrokenReferences = (node: HotelNode, definedTerms: Set<string>, issues: HealthIssue[] = []): HealthIssue[] => {
    // Basit heuristic: Büyük harfle başlayan ve tırnak içinde olmayan kelimeler başka bir servise referans olabilir.
    // Şimdilik false-positive riskinden dolayı devre dışı bırakıldı veya çok basit tutuldu.
    if (node.children) {
        node.children.forEach(c => findBrokenReferences(c, definedTerms, issues));
    }
    return issues;
}

const findMissingServiceDetails = (node: HotelNode, issues: HealthIssue[] = []): HealthIssue[] => {
    // SADECE FİZİKSEL HİZMETLERİ TARA (QA, Not, Politika HARİÇ)
    if (['qa_pair', 'note', 'policy', 'field'].includes(String(node.type))) return issues;

    const name = (node.name || '').toLowerCase();
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
        const textContent = (node.value || '').toLowerCase();
        const hasTimeInText = textContent.includes(':') && /\d/.test(textContent); // Basit saat kontrolü örn: 10:00

        if (!hasTime && !hasTimeInText && !hasLocation && !node.children?.length) {
             issues.push(createIssue(
                 node, 
                 'optimization', 
                 `"${node.name}" önemli bir hizmet ancak saat veya konum bilgisi eksik görünüyor.`, 
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

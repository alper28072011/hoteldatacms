

import { GoogleGenAI, Type } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, AIPersona, NodeAttribute } from "../types";
import { generateCleanAIJSON, generateAIText, getLocalizedValue } from "../utils/treeUtils";

const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const modelConfig = {
  model: 'gemini-3-flash-preview', 
};

const MAX_CONTEXT_LENGTH = 50000; 

// --- TYPES FOR AUTO-FIX ---
export interface AutoFixAction {
  id: string;
  type: 'move' | 'update' | 'changeType';
  targetId: string; // The node ID being modified
  destinationId?: string; // For 'move' actions (new parent)
  payload?: Partial<HotelNode>; // For updates (name, value, etc.)
  reasoning: string;
  severity: 'critical' | 'structural' | 'content';
}

export const translateText = async (text: string, targetLang: string): Promise<string> => {
    if (!text || !text.trim()) return '';
    try {
        const prompt = `Translate the following hotel content to ${targetLang === 'en' ? 'English' : 'Turkish'}. 
        Keep formatting, numbers, and technical terms. Return ONLY the translation.
        
        Text: "${text}"`;
        
        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt
        });
        return response.text?.trim() || '';
    } catch (e) {
        console.error("Translation failed", e);
        return text; // Fallback to original
    }
}

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    let textContext = await generateAIText(data, () => {});
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH);
    }
    
    const prompt = `Sen uzman bir Otel Veri Analistisin. Aşağıdaki yapılandırılmış otel verilerini incele ve otelin sunduğu hizmetlerin bir özetini çıkar. Eksik kategorileri veya güçlü yanları belirle.
    
    Veri (Markdown Formatında):
    ${textContext}
    
    ÇIKTIYI TÜRKÇE OLARAK VER.
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt
    });

    return response.text || "Yanıt oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Analiz başarısız. Lütfen API anahtarını veya ağ bağlantısını kontrol edin.");
  }
};

export const chatWithData = async (
  data: HotelNode, 
  userMessage: string, 
  history: {role: string, parts: string[]}[],
  activePersona?: AIPersona | null
): Promise<string> => {
  try {
    let textContext = await generateAIText(data, () => {}); 
    
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH) + "\n...[Data Truncated]...";
    }
    
    const now = new Date();
    const dayName = now.toLocaleDateString('tr-TR', { weekday: 'long' }); 
    const timeStr = now.toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit' }); 
    
    let identityBlock = "KİMLİK: Sen Gelişmiş bir Otel Asistanısın (Yapay Zeka). Kibar, yardımsever ve profesyonelsin.";
    let toneBlock = "TON: Profesyonel, Yardımcı, Net.";
    let rulesBlock = "";
    
    if (activePersona) {
        identityBlock = `KİMLİK: Sen ${activePersona.name}, bu oteldeki rolün: ${activePersona.role}.`;
        toneBlock = `TON: ${activePersona.tone}. DİL STİLİ: ${activePersona.languageStyle}.`;
        
        if (activePersona.instructions && activePersona.instructions.length > 0) {
            rulesBlock = `KRİTİK DAVRANIŞ KURALLARI:\n${activePersona.instructions.map(i => `- ${i}`).join('\n')}`;
        }
    }

    const systemInstruction = `
    ${identityBlock}
    
    GÜNCEL BAĞLAM:
    - Gün/Tarih: ${dayName}, ${now.toLocaleDateString('tr-TR')}
    - Saat: ${timeStr}
    
    ${toneBlock}
    ${rulesBlock}

    **VERİ OKUMA KILAVUZU (ÖNEMLİ):**
    Aşağıdaki otel veritabanı "Hiyerarşik Liste" formatındadır.
    1. **Ana Başlıklar (#)**: Kategori veya alanları gösterir.
    2. **Öğeler (-)**: Spesifik hizmetleri veya odaları gösterir.
    3. **Detaylar (Feature)**: Bu işaretin olduğu satırlar teknik özellikleri (Attributes) ve detayları içerir.
       - "Feature Key: Value": Bu formatı görürsen, bu özellik doğrudan üstteki öğeye aittir. Örn: "Oda Alanı: 58m2".
    
    **GÖREV AKIŞI:**
    
    ADIM 1: ARA VE BUL
    Kullanıcının sorusundaki anahtar kelimeleri (Örn: "Yatak", "Bed", "Manzara") veritabanında ara.
    - Eğer bir oda soruluyorsa, o odanın altındaki (+ [Feature]) ile başlayan tüm özelliklere bak.
    - Eğer "AI_NOTE" varsa, o bilgiyi öncelikli kural olarak kabul et.
    
    ADIM 2: CEVAPLA
    Bulduğun bilgiyi kullanarak doğal bir dille cevap ver. Asla "Veritabanında şöyle yazıyor" deme, doğrudan bilgi ver.
    
    OTEL VERİTABANI (LIVE DATA):
    ${textContext}
    `;

    const chat = ai.chats.create({
      model: modelConfig.model,
      config: { 
          systemInstruction,
          temperature: activePersona ? activePersona.creativity : 0.5 
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0] }]
      }))
    });

    const result = await chat.sendMessage({ message: userMessage });
    return result.text || "Buna nasıl cevap vereceğimi bilemiyorum.";
  } catch (error) {
    console.error(error);
    return "Otel veritabanına erişirken bir sorun yaşadım (Bağlantı Hatası).";
  }
};

// --- ARCHITECT COMMAND PROCESSOR (Enhanced with Intent & Routing) ---
export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `Sen bir Otel CMS (İçerik Yönetim Sistemi) için "Akıllı Veri Mimarı ve Sınıflandırma Uzmanı"sın.
    
    GÖREVİN:
    Kullanıcının doğal dil komutunu analiz et, verinin NİYETİNİ (Intent) belirle ve bu niyete en uygun kategoriyi bularak işlemi planla.
    
    KULLANICI KOMUTU: "${userCommand}"
    
    **ADIM 1: NİYET (INTENT) TESPİTİ**
    Metni analiz et ve şu 6 niyetten birini seç:
    - 'informational': Genel bilgi, saatler, tanımlar.
    - 'request': Misafirin isteyebileceği hizmetler (Oda servisi, havlu).
    - 'policy': Yasaklar, kurallar, şartlar (Yaş sınırı, kıyafet kuralı).
    - 'complaint': Şikayet yönetimi ile ilgili prosedürler.
    - 'safety': Güvenlik, acil durum, sağlık.
    - 'navigation': Konum, harita, yön tarifi.
    
    **ADIM 2: HEDEF KATEGORİ YÖNLENDİRMESİ**
    Mevcut JSON ağacını tara ve NİYET'e en uygun "Category" tipindeki ebeveyni bul.
    - Eğer Intent = 'policy' ise -> "Kurallar", "Politikalar", "Rules" içeren kategorileri ara.
    - Eğer Intent = 'request' ise -> "Hizmetler", "Services", "İstekler" kategorilerini ara.
    - Eğer Intent = 'safety' ise -> "Güvenlik", "Acil Durum" kategorilerini ara.
    - Eğer uygun kategori yoksa, Root (Ana Dizin) altına ekle.
    
    **ADIM 3: EYLEM OLUŞTURMA**
    
    VERİTABANI (JSON):
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    DÖNÜŞ FORMATI (JSON):
    {
      "summary": "Kullanıcıya ne yapacağını anlatan detaylı Türkçe özet. Örn: 'Bu veriyi Yasaklar kategorisine, Policy niyetiyle ekliyorum.'",
      "actions": [
        {
          "type": "add" | "update" | "delete",
          "targetId": "Hedef ID (Ekleme yapıyorsan bulduğun Kategori ID'si, güncelleme ise o öğenin ID'si)",
          "data": { 
             "name": { "tr": "...", "en": "..." }, 
             "type": "item" | "policy" | "note" | "menu_item", 
             "value": { "tr": "...", "en": "..." }, 
             "intent": "informational" | "request" | "policy" | "complaint" | "safety" | "navigation",
             "description": { "tr": "...", "en": "..." },
             "features": { "Key": "Value" } 
          },
          "reason": "Teknik açıklama (Türkçe)"
        }
      ]
    }
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const rawText = response.text || "{}";
    let parsed: any = {};
    
    try {
        parsed = JSON.parse(rawText);
    } catch (e) {
        return { summary: "AI cevabı işlenirken hata oluştu. Lütfen komutu daha açık yazın.", actions: [] };
    }

    if (!parsed.actions || !Array.isArray(parsed.actions)) {
        parsed.actions = [];
    }

    return parsed as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("Mimar hatası.");
  }
};

export const processArchitectFile = async (data: HotelNode, fileBase64: string, mimeType: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `Bu yüklenen dosyayı (Resim/PDF) analiz et ve otel verilerini çıkararak mevcut yapıya entegre et.
    Verileri çıkarırken her biri için doğru 'intent' (informational, policy, request, safety, complaint) değerini ata.
    Ayrıca isim ve açıklamaları hem Türkçe (tr) hem İngilizce (en) olarak çıkar.
    
    Mevcut Veri:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    Çıktı JSON formatında olmalı (ArchitectResponse: summary, actions).
    Özet ve veriler TÜRKÇE olmalı.
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: [
        { text: prompt },
        { inlineData: { mimeType, data: fileBase64 } }
      ],
      config: { responseMimeType: 'application/json' }
    });

    const rawText = response.text || "{}";
    let parsed: any = {};
    
    try {
        parsed = JSON.parse(rawText);
    } catch (e) {
        return { summary: "Dosya işleme hatası.", actions: [] };
    }

    return parsed as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("Dosya işleme hatası.");
  }
};

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
  try {
    let textContext = await generateAIText(data, () => {});
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH);
    }
    
    const prompt = `
    Sen bir Otel Veritabanı için "Semantik Tutarlılık ve Veri Körlüğü Denetçisi"sin (Data Blindness Auditor).
    
    GÖREV:
    Aşağıdaki otel verilerini (Markdown formatında, [ID: xxx] etiketleri ile) analiz et. Bir yapay zeka botunun bu veriyi okurken zorlanacağı noktaları (Veri Körlüğü) tespit et.
    
    ODAKLANMAN GEREKEN VERİ KÖRLÜĞÜ SEBEPLERİ:
    1. **Kopuk Nitelikler (Attribute Blindness):** Örn: "Oda Alanı: 58" yazılmış ama birim (m2) yok veya anahtar kelime çok belirsiz ("Değer: 58").
    2. **Eksik Bağlam (Missing Context):** Bir özellik tanımlanmış ama hangi odaya veya hizmete ait olduğu ağaç yapısında çok derin veya belirsiz.
    3. **Dil Eksikliği:** Kritik bir özellik sadece Türkçe girilmiş, İngilizce yok. Bu, uluslararası botlar için veri körlüğüdür.
    4. **Niyet (Intent) Uyuşmazlığı**: Bir kategori "Bilgi" ise, altında sert bir "Yasak/Policy" niyeti taşıyan öğe varsa uyar.
    
    PUANLAMA SİSTEMİ (0-100):
    Her analiz edilen düğüm (Node) için bir "AI Okunabilirlik Puanı" ver.
    - 0-40 (Kırmızı): Kritik eksik (İsim yok, değer yok, tamamen yanlış yerde).
    - 41-79 (Turuncu): Ortalama (Bağlam var ama birim eksik, sadece tek dil).
    - 80-100 (Yeşil): Mükemmel (Çift dilli, net anahtarlar, doğru hiyerarşi).

    GİRDİ VERİSİ:
    ${textContext}
    
    ÇIKTI ŞEMASI (JSON) - TÜM METİNLER TÜRKÇE OLMALI:
    {
      "score": number (Genel ortalama puan),
      "summary": "Genel analiz özeti (Türkçe).",
      "nodeScores": {
          "node_id_1": 85,
          "node_id_2": 40
      },
      "issues": [
        {
          "id": "ai_issue_x",
          "nodeId": "Sorunlu Node ID'si (textContext içindeki [ID: xxx] tag'inden al)",
          "nodeName": "Öğe ismi",
          "severity": "critical" | "warning" | "optimization",
          "message": "Sorunun Türkçe açıklaması (Örn: 'Oda Alanı' özelliği için birim (m2) eksik, AI bunu anlayamayabilir.)",
          "fix": { // OPSİYONEL
             "targetId": "ilgili ID",
             "action": "update",
             "data": { "intent": "policy" }, 
             "description": "Öneri (Türkçe)"
          }
        }
      ]
    }
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    return JSON.parse(response.text || "{}") as HealthReport;
  } catch (error) {
    console.error("Health Audit Error:", error);
    throw new Error("Sağlık raporu oluşturulamadı.");
  }
};

export const generateNodeContext = async (node: HotelNode, contextPath: string = '', language: 'tr' | 'en' = 'tr'): Promise<{ tags: string[], description: string }> => {
    const cleanNode = generateCleanAIJSON(node);
    
    const langName = language === 'en' ? 'English' : 'Turkish';
    
    const prompt = `
    You are an AI Data Enricher for a Hotel CMS.
    
    CONTEXT:
    Path: ${contextPath}
    Node Data: ${JSON.stringify(cleanNode, null, 2)}
    
    TASK:
    1. Generate 5-8 relevant "Search Tags" (Synonyms) in ${langName}.
    2. Write a "Hidden Description" (max 2 sentences) in ${langName} explaining the context or rules for an AI chatbot.
    
    SADECE JSON DÖNDÜR.
    `;
    
    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            description: {
              type: Type.STRING
            }
          },
          required: ["tags", "description"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
};

export const generateValueFromAttributes = async (nodeName: string, attributes: NodeAttribute[], language: 'tr' | 'en' = 'tr'): Promise<string> => {
    const langName = language === 'en' ? 'English' : 'Turkish';
    // Use getLocalizedValue to get keys/values in the requested language
    const attrsStr = attributes.map(a => `${getLocalizedValue(a.key, language)}: ${getLocalizedValue(a.value, language)}`).join(', ');
    
    const prompt = `
    Based on the attributes of the hotel item "${nodeName}", write a short, attractive "Main Value" sentence in ${langName}.
    
    Attributes: ${attrsStr}
    
    Example Input: Name: Airport Transfer, Attrs: Distance: 15km, Time: 20min
    Example Output (${language==='tr'?'TR':'EN'}): ${language==='tr' ? 'Havalimanına 15km uzaklıkta olup araçla yaklaşık 20 dakika sürmektedir.' : 'Located 15km from the airport, taking approximately 20 minutes by car.'}
    
    Sadece cümleyi döndür.
    `;
    
    const response = await ai.models.generateContent({
        model: modelConfig.model,
        contents: prompt
    });
    
    return response.text?.trim() || "";
}

// --- DEEP ANALYSIS & AUTO FIX ---
export const autoFixDatabase = async (rootNode: HotelNode): Promise<AutoFixAction[]> => {
    const cleanJson = JSON.stringify(generateCleanAIJSON(rootNode), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `
    Sen bir "Derin Veri Yapısı ve Anlamsal Bütünlük Denetçisi"sin (AI Architect).
    Göresin, aşağıdaki Otel CMS verisini (JSON) tarayarak bir AI Dil Modelinin (LLM) bu veriyi anlamasını zorlaştıracak hataları bulmak ve düzeltme önerileri sunmaktır.
    
    GÖREVLER:
    1. **YAPISAL DENETİM**:
       - Eğer bir 'item', 'field' veya 'menu_item' tipindeki öğenin altında çocuklar (children) varsa, bu bir hatadır. Tip 'category' veya 'list' olmalıdır.
       -> AKSİYON: type: 'changeType', payload: { type: 'category' }
    
    2. **ANLAMSAL (SEMANTİK) TUTARSIZLIK**:
       - Öğelerin Intent (Niyet) değerlerini kontrol et. Eğer bir öğe 'policy' niyetine sahipse ama 'General Info' altında duruyorsa, onu 'Rules' kategorisine taşı.
       -> AKSİYON: type: 'move', destinationId: 'İlgili en uygun Kategori ID'si (yoksa root ID)'
    
    3. **EKSİK NİYET**:
       - Eğer bir öğenin intent değeri yoksa veya yanlışsa (Örn: "Yüzmek Yasaktır" -> intent: informational), bunu düzelt.
       -> AKSİYON: type: 'update', payload: { intent: 'safety' }
    
    GİRDİ VERİSİ:
    \`\`\`json
    ${cleanJson}
    \`\`\`
    
    ÇIKTI FORMATI:
    Aşağıdaki JSON şemasına uygun bir dizi (Array) döndür. Sadece JSON döndür.
    
    [
      {
        "id": "benzersiz_bir_id",
        "type": "move" | "update" | "changeType",
        "targetId": "Sorunlu Öğenin ID'si (Input JSON'dan al)",
        "destinationId": "Sadece 'move' işlemi için hedef ID",
        "payload": { "key": "value" }, // 'update' veya 'changeType' için değişecek alanlar
        "reasoning": "Neden bu düzeltmeyi öneriyorsun? (Türkçe)",
        "severity": "critical" | "structural" | "content"
      }
    ]
    `;
    
    const response = await ai.models.generateContent({
        model: modelConfig.model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });
    
    const result = JSON.parse(response.text || "[]");
    return Array.isArray(result) ? result : [];
}

export const runDataCheck = async (data: HotelNode, inputType: 'url' | 'text' | 'file', inputValue: string, mimeType?: string): Promise<DataComparisonReport> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const basePrompt = `Otel Veritabanı JSON'ını sağlanan Kaynak Materyal ile karşılaştır.
    Uyuşmazlıkları (Fiyat farkları, eksik öğeler, yanlış saatler) tespit et.
    Çıktı TÜRKÇE olmalı.
    
    Veritabanı:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    `;
    
    let contents = [];
    if (inputType === 'url') {
        contents = [{ text: `${basePrompt}\n\nKaynak URL: ${inputValue} (Lütfen bu URL içeriğini tara)` }];
    } else if (inputType === 'file') {
        contents = [
            { text: basePrompt }, 
            { inlineData: { mimeType: mimeType || 'application/pdf', data: inputValue } }
        ];
    } else {
        contents = [{ text: `${basePrompt}\n\nKaynak Metin: "${inputValue}"` }];
    }
    
    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: contents,
      config: { responseMimeType: 'application/json' }
    });
    
    return JSON.parse(response.text || "{}") as DataComparisonReport;
  } catch (error) {
    console.error(error);
    throw new Error("Veri kontrolü hatası.");
  }
};

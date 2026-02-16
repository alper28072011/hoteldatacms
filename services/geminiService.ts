
import { GoogleGenAI, Type } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, AIPersona, NodeAttribute } from "../types";
import { generateCleanAIJSON, generateAIText } from "../utils/treeUtils";

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

    **GÖREV AKIŞI (INTENT-DRIVEN LOGIC):**
    
    ADIM 1: KULLANICI NİYETİNİ (INTENT) ANALİZ ET
    Kullanıcının mesajını şu kategorilerden birine koy:
    - **Informational**: Bilgi istiyor (Saat kaçta açılıyor? Havuz nerede?)
    - **Request**: Bir hizmet istiyor (Odaya havlu, taksi çağırma)
    - **Policy**: Kural soruyor (Sigara içiliyor mu? Evcil hayvan yasak mı?)
    - **Complaint**: Şikayet ediyor (Klima bozuk, yemek soğuk)
    - **Safety**: Acil durum veya güvenlik (Doktor var mı? Yangın merdiveni nerede?)
    
    ADIM 2: VERİ FİLTRELEME VE ODAKLANMA
    Veritabanında cevap ararken, tespit ettiğin NİYET'e uygun etiketlere (Tags) ve [INTENT: ...] işaretlerine öncelik ver.
    - **Eğer COMPLAINT ise**: Prosedürlere, misafir ilişkileri numaralarına ve çözüm protokollerine bak. "Özür dile ve çözüm sun".
    - **Eğer SAFETY ise**: En kısa, en net ve hayati bilgiyi ver.
    - **Eğer REQUEST ise**: O hizmetin "Ücretli mi?" ve "Nasıl talep edilir?" bilgisini kontrol et.
    
    ADIM 3: CEVAP OLUŞTURMA
    - Cevabın başına (kendi iç monoloğun olarak, kullanıcıya göstermeden) şunu düşün: "Tespit Edilen Niyet: [INTENT]".
    - Sonra kullanıcıya cevabı ver.
    
    KURALLAR:
    1. Sadece aşağıda verilen OTEL VERİTABANI bilgilerini kullanarak cevap ver. Bilgi uydurma.
    2. **TÜRKÇE**: Cevapların tamamı akıcı ve doğal Türkçe olmalı.
    
    OTEL VERİTABANI (Intent Etiketli - Rosetta Format: TR (EN)):
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
    Sen bir Otel Veritabanı için "Semantik Tutarlılık ve Veri İlişkisi Denetçisi"sin.
    
    GÖREV:
    Aşağıdaki otel verilerini (Markdown formatında, [INTENT] etiketleri ile) analiz et.
    
    ŞUNLARA ODAKLAN:
    1. **Niyet (Intent) Uyuşmazlığı**: Bir kategori "Bilgi" ise, altında sert bir "Yasak/Policy" niyeti taşıyan öğe varsa uyar.
    2. **Mantıksal Tutarsızlık**: "7/24 Açık" yazıp attribute olarak "Kapanış: 22:00" girilmişse uyar.
    3. **Kırık Referanslar**: (Örn: Bir oda "VIP Kahvaltı" içeriyor diyor ama "VIP Kahvaltı" listelerde yok).
    
    GİRDİ VERİSİ:
    ${textContext}
    
    ÇIKTI ŞEMASI (JSON) - TÜM METİNLER TÜRKÇE OLMALI:
    {
      "score": number (0-100),
      "summary": "Kısa analiz özeti (Türkçe).",
      "issues": [
        {
          "id": "ai_issue_x",
          "nodeId": "Bulabildiğin en yakın ID veya öğe ismi",
          "nodeName": "Öğe ismi",
          "severity": "critical" | "warning" | "optimization",
          "message": "Sorunun Türkçe açıklaması (Örn: Bu bir KURAL verisidir, 'policies_rules' altına taşınması önerilir)",
          "fix": { // OPSİYONEL
             "targetId": "ilgili ID",
             "action": "update",
             "data": { "intent": "policy" }, // Örn: Niyeti düzelt
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

export const generateNodeContext = async (node: HotelNode, contextPath: string = ''): Promise<{ tags: string[], description: string }> => {
    const cleanNode = generateCleanAIJSON(node);
    
    const prompt = `
    Bir Otel CMS'i için AI Veri Zenginleştiricisin.
    
    BAĞLAM:
    Yol: ${contextPath}
    Öğe Verisi: ${JSON.stringify(cleanNode, null, 2)}
    
    GÖREV:
    1. Bir misafirin bunu bulmak için kullanabileceği 5-8 alakalı "Arama Etiketi" (Eş anlamlılar, Türkçe) oluştur.
    2. Bir AI chatbot için "Gizli Açıklama" (max 2 cümle, Türkçe) yaz. Bağlamı, kuralları açıkla.
    
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

export const generateValueFromAttributes = async (nodeName: string, attributes: NodeAttribute[]): Promise<string> => {
    const attrsStr = attributes.map(a => `${a.key}: ${a.value}`).join(', ');
    const prompt = `
    "${nodeName}" adlı otel öğesinin özelliklerine dayanarak, kısa, çekici bir "Ana Değer" cümlesi yaz (Türkçe).
    
    Özellikler: ${attrsStr}
    
    Örnek Girdi: İsim: Havalimanı Transfer, Özellikler: Mesafe: 15km, Süre: 20dk
    Örnek Çıktı: Havalimanına 15km uzaklıkta olup araçla yaklaşık 20 dakika sürmektedir.
    
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

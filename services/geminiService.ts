
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

    TALİMATLAR:
    1. Sadece aşağıda verilen OTEL VERİTABANI bilgilerini kullanarak cevap ver. Bilgi uydurma.
    2. **ZAMAN FARKINDALIĞI**: Kullanıcı "Şu an ne yapabilirim?" diye sorarsa, veritabanındaki etkinlik saatlerini ve restoran açılış saatlerini şu anki saat (${timeStr}) ile karşılaştır.
    3. **TÜRKÇE**: Cevapların tamamı akıcı ve doğal Türkçe olmalı.
    
    OTEL VERİTABANI (Okunabilir Format):
    ${textContext}
    `;

    const chat = ai.chats.create({
      model: modelConfig.model,
      config: { 
          systemInstruction,
          temperature: activePersona ? activePersona.creativity : 0.7 
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

// --- ARCHITECT COMMAND PROCESSOR (Enhanced) ---
export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `Sen bir Otel CMS (İçerik Yönetim Sistemi) için "Akıllı Veri Mimarı ve Sistem Yöneticisi"sin.
    
    GÖREVİN:
    Aşağıdaki tam otel veri ağacını (JSON) tara ve kullanıcının doğal dil ile verdiği komutu uygulamak için gerekli teknik işlemleri belirle.
    
    KULLANICI KOMUTU: "${userCommand}"
    
    **TİP ÇIKARIM KURALLARI (TYPE INFERENCE RULES - CRITICAL):**
    1. **POLİTİKALAR/KURALLAR**: Eğer kullanıcı bir "Politika", "Kural", "Şart" veya "Not" ekliyorsa, tip **'policy'** veya **'note'** olmalıdır. ASLA 'category' yapma (kırmızı uyarı ikonu çıkıyor).
    2. **MENÜLER**: "Menü" oluşturuluyorsa tip **'menu'**. Menüye yemek/içecek ekleniyorsa tip **'menu_item'**.
    3. **LİSTELER**: Sadece isim listesi ise (örn: TV Kanalları) tip **'list'** ve alt öğeler **'item'**.
    4. **KLASÖRLER**: Sadece ve sadece başka şeyleri gruplamak içinse **'category'**.
    
    İŞLEM ADIMLARI (DÜŞÜNME SÜRECİ):
    1. **ARAMA & TESPİT**: Komutta geçen anahtar kelimeleri (Örn: "Kapalı Havuz") tüm JSON içinde ara. İsimleri, açıklamaları, etiketleri ve özellikleri (attributes) kontrol et.
    2. **MEVCUT DURUM ANALİZİ**:
       - Bulduğun öğenin özelliklerinde (attributes) istenen bilgi zaten var mı? (Örn: Key: "Çalışma Saatleri", Value: "09:00-18:00").
       - Yoksa, ana değerinde (value) veya açıklamasında (description) mı yazıyor?
       - Yoksa, bu bir 'schemaType' (event/dining) verisi içinde mi? (data objesi).
    3. **EYLEM BELİRLEME**:
       - **GÜNCELLEME (Update)**: Eğer veri varsa, onu güncelle.
       - **EKLEME (Add)**: Eğer veri yoksa ama uygun bir kategori varsa (Örn: "Havuzlar" kategorisi), yeni bir öğe ekle.
       - **SİLME (Delete)**: Kullanıcı istediyse sil.
    
    KURALLAR:
    - **ID KULLANIMI**: İşlemler için mutlaka mevcut öğelerin 'id'lerini kullan. Uydurma ID kullanma (ekleme hariç).
    - **ÖZELLİK (ATTRIBUTE) GÜNCELLEME**: Eğer bir özelliği (key-value) değiştireceksen, "features" objesi içinde gönder. Örn: "features": { "Çalışma Saatleri": "08:00 - 20:00" }.
    - **ŞEMA (SCHEMA) GÜNCELLEME**: Eğer 'data' objesini (Örn: Event saatleri) değiştireceksen, sadece değişen kısımları değil, o yapının tutarlı halini gönder.
    - **TÜRKÇE**: Özet (summary) ve neden (reason) alanları kesinlikle Türkçe olmalı.
    
    VERİTABANI (JSON):
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    DÖNÜŞ FORMATI (JSON):
    {
      "summary": "Kullanıcıya ne yapacağını anlatan detaylı Türkçe özet.",
      "actions": [
        {
          "type": "add" | "update" | "delete",
          "targetId": "Hedef ID (Mevcut bir ID olmalı, kök dizine ekliyorsan root ID)",
          "data": { 
             "name": "...", 
             "type": "...", // YUKARIDAKİ TİP KURALLARINA UY
             "value": "...", 
             "description": "...",
             "features": { "Key": "Value" }, // Özellik güncellemeleri için
             "data": { ... } // Schema tipi veriler için (Event, Dining)
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
    Sen bir Otel Veritabanı için "Veri İlişkisi ve Mantık Denetçisi"sin.
    
    GÖREV:
    Aşağıdaki otel verilerini (Markdown formatında) ilişkisel ve mantıksal tutarsızlıklar açısından analiz et.
    
    ŞUNLARA BAK:
    1. **Kırık Referanslar**: (Örn: Bir oda "VIP Kahvaltı" içeriyor diyor ama "VIP Kahvaltı" listelerde yok).
    2. **Çelişkiler**: (Örn: "Havuz Bar 24 saat açık" diyor ama başka yerde "Havuz 20:00'de kapanır" yazıyor).
    3. **Mantıksal Boşluklar**: (Örn: Bir "Steakhouse" var ama açılış saati veya kıyafet kuralı girilmemiş).
    4. **Yazım Hataları**: İsimlerdeki bariz hatalar.
    
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
          "message": "Sorunun Türkçe açıklaması",
          "fix": { // OPSİYONEL
             "targetId": "ilgili ID",
             "action": "update",
             "data": { "key": "value" },
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
       - Öğelerin bulundukları kategoriye uygun olup olmadığını kontrol et.
       - Örn: "Oda Servisi Menüsü" içinde "Yüzme Havuzu Kuralları" varsa, bu yanlıştır.
       -> AKSİYON: type: 'move', destinationId: 'İlgili en uygun Kategori ID'si (yoksa root ID)'
    
    3. **İÇERİK ZENGİNLEŞTİRME**:
       - Eğer bir öğenin ismi var ama 'value' (değer/açıklama) kısmı boşsa ve özellikleri (attributes) varsa; özelliklerden yola çıkarak Türkçe bir özet cümle yaz.
       -> AKSİYON: type: 'update', payload: { value: 'Oluşturulan Türkçe Cümle' }
    
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

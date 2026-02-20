import { GoogleGenAI, Type } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, AIPersona, NodeAttribute, SimulationResponse } from "../types";
import { generateCleanAIJSON, generateAIText, getLocalizedValue } from "../utils/treeUtils";

const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const modelConfig = {
  model: 'gemini-3-flash-preview', 
};

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

export const optimizeAILabel = async (text: string, lang: 'tr' | 'en'): Promise<string> => {
    if (!text || !text.trim()) return '';
    try {
        const langName = lang === 'tr' ? 'Turkish' : 'English';
        const prompt = `
        Sen uzman bir "Veri Mimarı" ve "UX Yazarı"sın.
        
        GÖREV:
        Kullanıcının doğal dille girdiği ham ifadeyi, bir Otel Yönetim Sistemi (CMS) şablonu için en uygun, kısa, profesyonel ve AI modellerinin kolayca anlayabileceği bir "Alan Etiketi"ne (Field Label) dönüştür.
        
        KURALLAR:
        1. Çıktı dili KESİNLİKLE ${langName} olmalıdır.
        2. Çıktı çok kısa ve net olmalı (Genellikle 1-4 kelime).
        3. Başlık Düzeni (Title Case) kullan.
        4. Soru cümlelerini isim tamlamasına çevir (Örn: "Oda ne kadar büyük?" -> "Oda Büyüklüğü").
        5. "Buraya ... yazın" gibi ifadeleri temizle, sadece özü al.
        
        KULLANICI GİRDİSİ: "${text}"
        
        Sadece optimize edilmiş etiketi döndür.
        `;
        
        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt
        });
        return response.text?.trim() || text;
    } catch (e) {
        console.error("Label optimization failed", e);
        return text;
    }
};

export const optimizeAIDescription = async (text: string, lang: 'tr' | 'en'): Promise<string> => {
    if (!text || !text.trim()) return '';
    try {
        const langName = lang === 'tr' ? 'Turkish' : 'English';
        const prompt = `
        Sen uzman bir "Veri Mimarı" ve "Prompt Mühendisi"sin.
        
        GÖREV:
        Aşağıda bir otel veri yönetim sistemi (CMS) için kullanıcı tarafından girilmiş ham bir alan açıklaması var.
        Bu açıklamayı, bir Yapay Zeka (LLM) botunun bu alanın ne işe yaradığını ve misafir sorularına nasıl yanıt vermesi gerektiğini en iyi anlayacağı şekilde yeniden yaz ve optimize et.
        
        KURALLAR:
        1. Çıktı dili KESİNLİKLE ${langName} olmalıdır.
        2. Açıklama net, emir kipi içeren ve bağlam sağlayan bir formatta olmalı.
        3. Gereksiz kelimeleri at, teknik ve açıklayıcı ol.
        4. Sadece optimize edilmiş metni döndür, başka bir şey yazma.
        
        KULLANICI GİRDİSİ: "${text}"
        
        ÖRNEK ÇIKTI (TR): "Bu alan odanın deniz, kara veya havuz manzaralı olup olmadığını belirtir. Misafir manzara sorduğunda bu veriyi kullan."
        `;
        
        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt
        });
        return response.text?.trim() || text;
    } catch (e) {
        console.error("Optimization failed", e);
        return text;
    }
};

export const evaluateNodeHealth = async (node: HotelNode, parentPath: string): Promise<HotelNode['aiAnalysis']> => {
    try {
        const cleanNode = generateCleanAIJSON(node);
        const prompt = `
        Sen bir Otel CMS veri kalite denetçisisin. Aşağıdaki veriyi analiz et.
        
        BAĞLAM YOLU: ${parentPath}
        VERİ: ${JSON.stringify(cleanNode, null, 2)}
        
        GÖREVLER:
        1. **Mantıksal Tutarlılık**: Bu veri bu kategoride (path) mantıklı mı? Fiyat, süre, yaş sınırı gibi değerler gerçekçi mi?
        2. **Dil ve Çeviri**: Türkçe (TR) ve İngilizce (EN) alanları uyumlu mu? Eksik çeviri veya anlamsız çeviri var mı?
        3. **AI Okunabilirliği**: Bir yapay zeka bu veriyi okuduğunda (örneğin "Değer: 50" ama birim yok) körlük yaşar mı?
        
        ÇIKTI FORMATI (JSON):
        {
            "summary": "Tek cümlelik Türkçe özet durum.",
            "score": 0-100 arası puan,
            "issues": [
                {
                    "type": "logic" | "translation" | "context" | "missing",
                    "message": "Sorunun kısa açıklaması (Türkçe)",
                    "severity": "info" | "warning" | "critical"
                }
            ],
            "suggestion": "Nasıl düzeltileceğine dair kısa bir öneri."
        }
        
        Eğer her şey mükemmelse issues boş dizi olsun ve score 100 olsun.
        `;

        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const result = JSON.parse(response.text || "{}");
        return result;

    } catch (e) {
        console.error("Node analysis failed", e);
        return undefined;
    }
}

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    // LIMITS REMOVED: Sending full context
    const textContext = await generateAIText(data, () => {});
    
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
): Promise<SimulationResponse> => {
  try {
    // LIMITS REMOVED: Full data access enabled for maximum accuracy on large datasets (e.g. 500+ rooms)
    const textContext = await generateAIText(data, () => {}); 
    
    const now = new Date();
    
    let personaInstruction = "KİMLİK: Sen 'Veri Simülatörü'sün. Görevin, aşağıdaki veri setini KESİN BİR ŞEKİLDE tarayarak kullanıcı sorularını sadece bu verilere dayanarak cevaplamaktır.";
    
    if (activePersona) {
        personaInstruction = `KİMLİK: Sen ${activePersona.name} (${activePersona.role}). TON: ${activePersona.tone}. STİL: ${activePersona.languageStyle}.`;
    }

    const systemInstruction = `
    ${personaInstruction}
    
    GÖREVİN:
    1. Kullanıcının sorusunu analiz et (Niyet Tespiti).
    2. Aşağıdaki OTEL VERİTABANI'nı satır satır tara.
    3. Soruya en uygun cevabı bul.
    4. Cevabı verirken VERİ KÖRLÜĞÜ (Data Blindness) kontrolü yap.
    
    KURALLAR:
    - ASLA veri tabanında olmayan bir bilgiyi uydurma. Veri yoksa "Veritabanında bu bilgi mevcut değil" de.
    - Eğer bir veri bulduysan ama birim (m2, kg, $) eksikse, bunu "Veri Körlüğü" olarak raporla.
    - Cevabını sadece sorulan soruyla sınırla.
    
    OTEL VERİTABANI (Canlı Yapı - Tam Erişim):
    ${textContext}
    
    ÇIKTI FORMATI (JSON):
    Cevabını ve analizini aşağıdaki JSON formatında döndür:
    {
      "answer": "Kullanıcıya vereceğin doğal dil cevabı. (Burada Persona özelliklerini kullan)",
      "intent": "Kullanıcının niyeti (Örn: Fiyat Sorgusu, Özellik Kontrolü, Şikayet)",
      "analysis": "Veriyi ağacın neresinde buldun? (Path > Item > Feature formatında teknik bilgi)",
      "dataHealth": "good" | "missing_info" | "ambiguous" | "hallucination_risk",
      "blindness": "Eğer veri körlüğü (birim eksikliği, bağlam kopukluğu) varsa buraya yaz, yoksa 'None' yaz.",
      "suggestion": "Veri modelini iyileştirmek için kısa bir öneri (Opsiyonel)."
    }
    `;

    const chat = ai.chats.create({
      model: modelConfig.model,
      config: { 
          systemInstruction,
          temperature: activePersona ? activePersona.creativity : 0.3, // Lower temperature for accuracy
          responseMimeType: 'application/json'
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0] }]
      }))
    });

    const result = await chat.sendMessage({ message: userMessage });
    
    try {
        return JSON.parse(result.text || "{}") as SimulationResponse;
    } catch (e) {
        // Fallback for parsing errors
        return {
            answer: result.text || "Bir hata oluştu.",
            intent: "Unknown",
            dataHealth: "ambiguous",
            analysis: "Raw text returned",
            blindness: "Parsing Error"
        };
    }

  } catch (error) {
    console.error(error);
    return {
        answer: "Otel veritabanına erişirken bir sorun yaşadım. (Bağlantı Hatası)",
        intent: "Error",
        dataHealth: "missing_info",
        analysis: "Connection Failed",
        blindness: "System Error"
    };
  }
};

// --- ARCHITECT COMMAND PROCESSOR (Enhanced with Intent & Routing) ---
export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    // LIMITS REMOVED
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2);
    
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
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2);
    
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
      contents: {
        parts: [
            { text: prompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: fileBase64
                }
            }
        ]
      },
      config: { responseMimeType: 'application/json' }
    });

    const rawText = response.text || "{}";
    try {
        const parsed = JSON.parse(rawText);
        if (!parsed.actions || !Array.isArray(parsed.actions)) {
            parsed.actions = [];
        }
        return parsed as ArchitectResponse;
    } catch (e) {
        return { summary: "Dosya işlenirken hata oluştu.", actions: [] };
    }
  } catch (error) {
    console.error(error);
    throw new Error("Dosya işleme hatası.");
  }
};

export const generateNodeContext = async (node: HotelNode, pathString: string, lang: 'tr' | 'en'): Promise<{ tags: string[], description: string }> => {
    try {
        const nodeData = JSON.stringify(generateCleanAIJSON(node), null, 2);
        const prompt = `
        Analyze this hotel data node.
        Path: ${pathString}
        Data: ${nodeData}
        
        Task:
        1. Generate 5-10 SEO/Search tags relevant to this item (${lang}).
        2. Write a short, hidden AI context note (${lang}) that explains what this node is for an LLM (e.g. "This node contains the opening hours for the main pool").
        
        Output JSON: { "tags": string[], "description": string }
        `;
        
        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || '{"tags":[], "description":""}');
    } catch(e) {
        return { tags: [], description: "" };
    }
}

export const generateValueFromAttributes = async (name: string, attributes: NodeAttribute[], lang: 'tr' | 'en'): Promise<string> => {
    try {
        const attrs = attributes.map(a => `${getLocalizedValue(a.key, lang)}: ${getLocalizedValue(a.value, lang)}`).join(', ');
        const prompt = `
        Create a natural language summary sentence (${lang}) for an item named "${name}" with these attributes: ${attrs}.
        Keep it concise.
        `;
        const response = await ai.models.generateContent({
             model: modelConfig.model,
             contents: prompt
        });
        return response.text?.trim() || "";
    } catch(e) { return ""; }
}

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
    try {
        const textContext = await generateAIText(data, () => {});
        
        const prompt = `
        You are a Data Quality Auditor for a Hotel CMS.
        Analyze the following hotel data structure for:
        1. Completeness (Missing descriptions, prices, schedules).
        2. Consistency (Language mix, logical hierarchy errors).
        3. Semantic Sense (e.g. "Pool" inside "Room Service").
        
        Data (Markdown):
        ${textContext}
        
        Output JSON (HealthReport):
        {
            "score": number (0-100),
            "summary": "Short Turkish summary of health.",
            "issues": [
                {
                    "id": "unique_id",
                    "nodeId": "extracted_id_from_data", // Important: Extract [ID: ...] from text
                    "nodeName": "Name of node",
                    "severity": "critical" | "warning" | "optimization",
                    "message": "Issue description in Turkish",
                    "fix": { "targetId": "same_node_id", "action": "update", "data": {}, "description": "Fix desc" } (Optional)
                }
            ],
            "nodeScores": { "node_id": number (0-100) } // Score for specific nodes found in text
        }
        `;
        
        const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || '{"score": 0, "summary": "Error", "issues": []}');
    } catch(e) {
        console.error(e);
        return { score: 0, summary: "Analysis failed", issues: [] };
    }
}

export const autoFixDatabase = async (data: HotelNode): Promise<AutoFixAction[]> => {
    try {
         const textContext = await generateAIText(data, () => {});
         
         const prompt = `
         Analyze this hotel data structure and suggest structural fixes (Move, Update Type, Rename).
         Focus on Logical Hierarchy (e.g. 'Gym' shouldn't be under 'Restaurants').
         
         Data:
         ${textContext}
         
         Output JSON:
         [
            {
                "id": "fix_1",
                "type": "move" | "update" | "changeType",
                "targetId": "node_id",
                "destinationId": "parent_id_if_move",
                "payload": {}, 
                "reasoning": "Turkish explanation",
                "severity": "critical" | "structural" | "content"
            }
         ]
         `;
         
         const response = await ai.models.generateContent({
            model: modelConfig.model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || '[]');
    } catch(e) { return []; }
}

export const runDataCheck = async (data: HotelNode, sourceType: 'url' | 'text' | 'file', inputValue: string, mimeType?: string): Promise<DataComparisonReport> => {
     try {
        const textContext = await generateAIText(data, () => {});
        
        let contents: any[] = [];
        let prompt = `
        Compare the Internal Hotel Data below with the provided External Source.
        Find discrepancies (mismatched prices, hours, missing amenities).
        
        Internal Data:
        ${textContext}
        `;

        if (sourceType === 'url') {
            prompt += `\nExternal Source URL: ${inputValue}\n(Use your knowledge or search tools to verify if possible, otherwise infer from URL context)`;
            contents = [{ text: prompt }];
        } else if (sourceType === 'text') {
            prompt += `\nExternal Source Text:\n"${inputValue}"`;
            contents = [{ text: prompt }];
        } else if (sourceType === 'file') {
            prompt += `\nExternal Source File: (See attachment)`;
            contents = [
                { text: prompt },
                { inlineData: { mimeType: mimeType || 'application/pdf', data: inputValue } }
            ];
        }

        const systemInstruction = `
        Output JSON (DataComparisonReport):
        {
            "summary": "Turkish summary of comparison.",
            "sourceUrl": "${sourceType === 'url' ? inputValue : ''}",
            "items": [
                {
                    "id": "comp_1",
                    "category": "match" | "conflict" | "missing_internal" | "missing_external",
                    "field": "Field Name (e.g. Pool Hours)",
                    "internalValue": "Value in DB",
                    "externalValue": "Value in Source",
                    "description": "Explanation in Turkish",
                    "suggestedAction": { "type": "update" | "add", "targetId": "relevant_node_id", "data": {} } (Optional)
                }
            ]
        }
        `;

        const response = await ai.models.generateContent({
             model: modelConfig.model,
             contents: contents,
             config: { 
                 responseMimeType: 'application/json',
                 systemInstruction: systemInstruction,
                 tools: sourceType === 'url' ? [{ googleSearch: {} }] : undefined
             }
        });
        
        return JSON.parse(response.text || '{"summary": "Error", "items": []}');

     } catch(e) {
         console.error(e);
         return { summary: "Comparison failed.", items: [] };
     }
}

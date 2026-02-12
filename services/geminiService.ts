
import { GoogleGenAI } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport } from "../types";
import { generateCleanAIJSON } from "../utils/treeUtils";

// API Key yönetimi (Vite veya Process env)
const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper: Model yapılandırması
const modelConfig = {
  model: 'gemini-2.0-flash', // Veya 'gemini-1.5-pro' ihtiyaca göre
};

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    // OPTİMİZASYON: Temiz veri ve path bilgisi gönderiliyor
    const jsonString = JSON.stringify(generateCleanAIJSON(data), null, 2);
    
    const prompt = `You are an expert Hotel Data Analyst. Review the following JSON structure and provide a summary of the hotel's offerings, identifying any key strengths or missing categories.
    
    Data:
    \`\`\`json
    ${jsonString.substring(0, 100000)}
    \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze data. Please check your API key.");
  }
};

export const auditStructureDeeply = async (data: HotelNode): Promise<string> => {
  try {
     const jsonString = JSON.stringify(generateCleanAIJSON(data), null, 2);
     
     const prompt = `Act as a Senior Data Architect. Audit this hotel data structure for UX logic flaws.
     Focus on:
     1. Nested depth (is it too deep for a guest?)
     2. Missing prices in menus.
     3. Logical grouping errors.
     
     Data:
     \`\`\`json
     ${jsonString.substring(0, 100000)}
     \`\`\`
     `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt
    });

    return response.text || "No audit generated.";
  } catch (error) {
    console.error(error);
    throw new Error("Failed to perform audit.");
  }
}

export const chatWithData = async (
  data: HotelNode, 
  userMessage: string, 
  history: {role: string, parts: string[]}[]
): Promise<string> => {
  try {
    // CHAT OPTİMİZASYONU: Gereksiz UI state'lerini temizle
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, 1000000); 
    
    const now = new Date();
    const systemInstruction = `You are an Advanced Hotel Guest Assistant (AI). 
    Current Time: ${now.toLocaleString()}
    
    CRITICAL INSTRUCTION:
    You have access to the live hotel database below in JSON format.
    Every item (like a TV Channel, Dish, or Room) may have dynamic "Properties" flattened into the JSON object (e.g., "Dil": "Almanca", "Price": "10$", "Cuisine": "Italian").
    
    WHEN ANSWERING:
    1. Look specifically for these dynamic attributes to filter answers.
    2. If a user asks "Which channels are German?", look for items where "Dil" (Language) is "Almanca" (German).
    3. Use the "_path" field to understand context (e.g., "Main Restaurant > Dinner > Burgers").
    
    HOTEL DATABASE (JSON):
    ${jsonContext}
    `;

    const chat = ai.chats.create({
      model: modelConfig.model,
      config: { systemInstruction },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0] }]
      }))
    });

    const result = await chat.sendMessage({ message: userMessage });
    return result.text || "I'm not sure how to answer that.";
  } catch (error) {
    console.error(error);
    return "I'm having trouble accessing the hotel database right now.";
  }
};

export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, 200000);
    
    const prompt = `You are an AI Architect modifying a Hotel CMS structure.
    User Command: "${userCommand}"
    
    Current Structure:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    Return a JSON object with:
    {
      "action": "create" | "update" | "delete" | "move",
      "targetPath": "string (e.g., root > Dining)",
      "data": { ...new node data... },
      "reasoning": "Explanation"
    }
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    return JSON.parse(response.text || "{}") as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("Architect error.");
  }
};

export const processArchitectFile = async (data: HotelNode, fileBase64: string, mimeType: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, 200000);
    
    const prompt = `Analyze this uploaded image/PDF and extract hotel data to merge into the current structure.
    
    Current Data:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    Return JSON format compatible with ArchitectResponse.
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: [
        { text: prompt },
        { inlineData: { mimeType, data: fileBase64 } }
      ],
      config: { responseMimeType: 'application/json' }
    });

    return JSON.parse(response.text || "{}") as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("File process error.");
  }
};

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, 300000);
    
    const prompt = `
    You are the "Semantic Logic Auditor" for a Hotel Database.
    
    YOUR TASK:
    Analyze the data for LOGICAL and SEMANTIC inconsistencies ONLY.
    Ignore structural issues (like empty names/ids) as we check those locally.
    
    LOOK FOR:
    1. Contradictions (e.g., "No Alcohol Policy" but Menu contains "Wine").
    2. Ambiguous Content (e.g., "Open all day" instead of "08:00 - 22:00").
    3. Spelling/Typos in public facing names.
    4. Price logic (e.g., A luxury steak for $1).
    
    INPUT DATA:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    OUTPUT SCHEMA (JSON):
    {
      "score": number (0-100, purely based on semantic quality),
      "summary": "Short analysis summary.",
      "issues": [
        {
          "id": "ai_issue_x",
          "nodeId": "id from json",
          "nodeName": "name from json",
          "severity": "critical" | "warning" | "optimization",
          "message": "Description of logical flaw",
          "fix": { // OPTIONAL
             "targetId": "id from json",
             "action": "update",
             "data": { "key": "value" },
             "description": "Suggestion"
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
    throw new Error("Failed to generate semantic health report.");
  }
};

export const generateNodeContext = async (node: HotelNode): Promise<any> => {
    // Tekil node için temizleme yapıp yapmamak opsiyonel, ama temiz veri her zaman iyidir.
    const cleanNode = generateCleanAIJSON(node);
    const prompt = `Generate suitable metadata/tags for this hotel item: ${JSON.stringify(cleanNode, null, 2)}`;
    
    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    return JSON.parse(response.text || "{}");
};

export const runDataCheck = async (data: HotelNode, inputType: 'url' | 'text' | 'file', inputValue: string, mimeType?: string): Promise<DataComparisonReport> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, 200000);
    
    const basePrompt = `Compare the Hotel Database JSON with the provided Source Material.
    Identify discrepancies (Price mismatches, missing items, wrong hours).
    
    Database:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    `;
    
    let contents = [];
    if (inputType === 'url') {
        contents = [{ text: `${basePrompt}\n\nSource URL: ${inputValue} (Please browse this URL content if enabled, otherwise infer from structure)` }];
    } else if (inputType === 'file') {
        contents = [
            { text: basePrompt }, 
            { inlineData: { mimeType: mimeType || 'application/pdf', data: inputValue } }
        ];
    } else {
        contents = [{ text: `${basePrompt}\n\nSource Text: "${inputValue}"` }];
    }
    
    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: contents,
      config: { responseMimeType: 'application/json' }
    });
    
    return JSON.parse(response.text || "{}") as DataComparisonReport;
  } catch (error) {
    console.error(error);
    throw new Error("Data check error.");
  }
};


import { GoogleGenAI, Type } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, AIPersona } from "../types";
import { generateCleanAIJSON, generateAIText } from "../utils/treeUtils";

// API Key yönetimi (Vite veya Process env)
const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper: Model yapılandırması
// UPDATED: Switched to 'gemini-3-flash-preview' as per latest API availability
const modelConfig = {
  model: 'gemini-3-flash-preview', 
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
  history: {role: string, parts: string[]}[],
  activePersona?: AIPersona | null
): Promise<string> => {
  try {
    // CHAT OPTİMİZASYONU: JSON yerine Hiyerarşik Markdown kullanıyoruz.
    // generateAIText asenkron olduğu için await ile bekliyoruz.
    const textContext = await generateAIText(data, () => {}); 
    
    const now = new Date();
    
    // PERSONA CONSTRUCTION
    let identityBlock = "IDENTITY: You are an Advanced Hotel Guest Assistant (AI). You are helpful, polite, and neutral.";
    let toneBlock = "TONE: Professional, Helpful, Clear.";
    let rulesBlock = "";
    
    if (activePersona) {
        identityBlock = `IDENTITY: You are ${activePersona.name}, acting as the ${activePersona.role} at ${data.name || 'this hotel'}.`;
        toneBlock = `TONE: ${activePersona.tone}. LANGUAGE STYLE: ${activePersona.languageStyle}.`;
        
        if (activePersona.instructions && activePersona.instructions.length > 0) {
            rulesBlock = `CRITICAL BEHAVIOR RULES:\n${activePersona.instructions.map(i => `- ${i}`).join('\n')}`;
        }
    }

    const systemInstruction = `
    ${identityBlock}
    Current Time: ${now.toLocaleString()}
    ${toneBlock}
    ${rulesBlock}

    CRITICAL RULE: Do not invent information. Answer solely based on the provided HOTEL DATABASE below. Never mention "I checked the markdown file", just say "We have..." or "The hotel offers...".
    
    INSTRUCTIONS ON DATA SOURCE:
    You are provided with the live hotel database in a structured MARKDOWN format below.
    1. **HIERARCHY**: Use the Headings (#, ##, ###) to understand categories (e.g., "Restaurants", "Rooms").
    2. **ITEMS**: Bullet points (-) represent specific items (e.g., "Steakhouse", "Standard Room").
    3. **ATTRIBUTES**: Details like prices, hours, or specific features are often found in parentheses () next to the item name (e.g., "Price: 50$").
    4. **NOTES**: Contextual AI notes are indicated with "> Note:". Use these to understand implicit rules (e.g., "Adults only").
    
    HOTEL DATABASE (Markdown Format):
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

export const generateNodeContext = async (node: HotelNode, contextPath: string = ''): Promise<{ tags: string[], description: string }> => {
    // We clean the node but we also pass the contextPath for better understanding
    const cleanNode = generateCleanAIJSON(node);
    
    const prompt = `
    You are an AI Data Enricher for a Hotel CMS.
    
    CONTEXT:
    Path: ${contextPath}
    Item Data: ${JSON.stringify(cleanNode, null, 2)}
    
    TASK:
    1. Generate 5-8 relevant "Search Tags" (synonyms, categories, related concepts) that a guest might use to find this.
    2. Write a "Hidden Description" (max 2 sentences) that explains implicit context, rules, or connections for an AI chatbot.
       - E.g. If it's a "Honeymoon Suite", implicit rule might be "Couples only, romantic atmosphere".
       - E.g. If "Steakhouse", implicit rule "Requires reservation, smart casual dress code".
    
    RETURN JSON ONLY.
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

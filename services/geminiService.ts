
import { GoogleGenAI, Type } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, AIPersona } from "../types";
import { generateCleanAIJSON, generateAIText } from "../utils/treeUtils";

const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const modelConfig = {
  model: 'gemini-3-flash-preview', 
};

const MAX_CONTEXT_LENGTH = 50000; 

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    // Use enriched markdown for analysis too, as it provides better context
    let textContext = await generateAIText(data, () => {});
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH);
    }
    
    const prompt = `You are an expert Hotel Data Analyst. Review the following structured hotel data and provide a summary of the hotel's offerings, identifying any key strengths or missing categories.
    
    Data (Markdown Format with Definition Injection):
    ${textContext}
    `;

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze data. Please check your network or API key.");
  }
};

export const auditStructureDeeply = async (data: HotelNode): Promise<string> => {
  try {
     const jsonString = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
     
     const prompt = `Act as a Senior Data Architect. Audit this hotel data structure for UX logic flaws.
     Focus on:
     1. Nested depth (is it too deep for a guest?)
     2. Missing prices in menus.
     3. Logical grouping errors.
     
     Data:
     \`\`\`json
     ${jsonString}
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
    // CRITICAL UPDATE: Use generateAIText (Smart Weaving) instead of JSON
    // This injects definitions like "Standard Minibar (Contents: Coke, Water)" directly into the context
    let textContext = await generateAIText(data, () => {}); 
    
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH) + "\n...[Data Truncated]...";
    }
    
    const now = new Date();
    
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

    CRITICAL RULE: Do not invent information. Answer solely based on the provided HOTEL DATABASE below. 
    
    UNDERSTANDING THE DATA:
    The data below is structured in Markdown.
    - IMPORTANT: Some items have definitions injected automatically (e.g. "Minibar (System Definition: Coke, Water)"). Use these definitions to answer "What is in the minibar?" questions.
    - If a Room Category has "Implicit Global Amenities", assume the room includes those items.
    
    HOTEL DATABASE (Relational Context Enabled):
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
    return "I'm having trouble accessing the hotel database right now (Network Error).";
  }
};

export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `You are an AI Architect.
    
    TASK:
    Analyze the "Current Structure" against the "User Command".
    
    CRITICAL RULES:
    1. **DUPLICATE CHECK**: Before creating anything, check if it already exists in the JSON.
       - If it exists and matches the user's request: Return NO actions and explain in 'summary'.
       - If it exists but needs modification: Return an 'update' action instead of 'create'.
    2. **HIERARCHY**: Find the most logical 'targetId' (parent ID) for new items.
    3. **PROPERTY UPDATES**: To set or update properties like 'Price', 'Opening Hours', 'Stars', or 'Cuisine', use a special "features" object inside "data".
       - Example: "data": { "name": "Steakhouse", "features": { "Price": "50$", "Dress Code": "Casual" } }
    4. **JSON ONLY**: Return strictly valid JSON matching the schema.
    
    User Command: "${userCommand}"
    
    Current Structure:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    RETURN JSON FORMAT:
    {
      "summary": "Explanation of what will be done (e.g. 'Found existing item, updating price' or 'Creating new category').",
      "actions": [
        {
          "type": "add" | "update" | "delete",
          "targetId": "ID of parent (for add) or ID of node (for update/delete)",
          "data": { "name": "...", "type": "...", "value": "...", "features": { "Key": "Value" } },
          "reason": "Why this action is taken"
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
        console.error("JSON Parse Error", e);
        return { summary: "Error parsing AI response.", actions: [] };
    }

    if (!parsed.actions || !Array.isArray(parsed.actions)) {
        parsed.actions = [];
    }

    return parsed as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("Architect error (Possible Network/Size Limit).");
  }
};

export const processArchitectFile = async (data: HotelNode, fileBase64: string, mimeType: string): Promise<ArchitectResponse> => {
  try {
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
    const prompt = `Analyze this uploaded image/PDF and extract hotel data to merge into the current structure.
    
    Current Data:
    \`\`\`json
    ${jsonContext}
    \`\`\`
    
    Return JSON format compatible with ArchitectResponse (summary, actions array).
    Ensure you check for existing data to avoid duplicates.
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
        return { summary: "Error parsing AI file response.", actions: [] };
    }

    if (!parsed.actions || !Array.isArray(parsed.actions)) {
        parsed.actions = [];
    }

    return parsed as ArchitectResponse;
  } catch (error) {
    console.error(error);
    throw new Error("File process error.");
  }
};

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
  try {
    // Generate context using smart weaving to reveal relationships
    let textContext = await generateAIText(data, () => {});
    if (textContext.length > MAX_CONTEXT_LENGTH) {
        textContext = textContext.substring(0, MAX_CONTEXT_LENGTH);
    }
    
    const prompt = `
    You are a "Data Relationship Expert" and "Semantic Logic Auditor" for a Hotel Database.
    
    YOUR TASK:
    Analyze the data (provided in enriched Markdown) for relational and logical inconsistencies.
    
    LOOK FOR:
    1. **Broken References / Undefined Services**: (e.g., A room mentions "VIP Breakfast" but "VIP Breakfast" is not defined anywhere in the lists or menus).
    2. **Contradictions**: (e.g., "Pool Bar open 24h" but "Pool closes at 20:00").
    3. **Logical Gaps**: (e.g., A "Steakhouse" exists but has no opening hours or dress code).
    4. **Spelling/Typos**: In public facing names.
    
    INPUT DATA:
    ${textContext}
    
    OUTPUT SCHEMA (JSON):
    {
      "score": number (0-100, purely based on relational/semantic quality),
      "summary": "Short analysis summary focusing on data relationships.",
      "issues": [
        {
          "id": "ai_issue_x",
          "nodeId": "Use the exact ID from the data if possible, or describe the path",
          "nodeName": "Name of the item",
          "severity": "critical" | "warning" | "optimization",
          "message": "Description of the relational flaw",
          "fix": { // OPTIONAL
             "targetId": "approximate ID",
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
    throw new Error("Failed to generate semantic health report (Network Limit).");
  }
};

export const generateNodeContext = async (node: HotelNode, contextPath: string = ''): Promise<{ tags: string[], description: string }> => {
    const cleanNode = generateCleanAIJSON(node);
    
    const prompt = `
    You are an AI Data Enricher for a Hotel CMS.
    
    CONTEXT:
    Path: ${contextPath}
    Item Data: ${JSON.stringify(cleanNode, null, 2)}
    
    TASK:
    1. Generate 5-8 relevant "Search Tags" (synonyms, categories, related concepts) that a guest might use to find this.
    2. Write a "Hidden Description" (max 2 sentences) that explains implicit context, rules, or connections for an AI chatbot.
    
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
    const jsonContext = JSON.stringify(generateCleanAIJSON(data), null, 2).substring(0, MAX_CONTEXT_LENGTH);
    
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


import { GoogleGenAI } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport, NodeContextPrediction } from "../types";
import { generateCleanAIJSON } from "../utils/treeUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    // OPTIMIZATION: Use Clean JSON to save tokens and remove noise
    const cleanData = generateCleanAIJSON(data);
    const jsonString = JSON.stringify(cleanData, null, 2);
    
    const prompt = `
      You are an expert Hotel Data Analyst. Review the following JSON structure representing a hotel's database.
      
      1. Summarize the hotel's key amenities and offerings.
      2. Identify any logical inconsistencies or missing critical information (e.g., a restaurant without hours, a room without capacity).
      3. Suggest 3 specific improvements to the data structure or content to make it better for a guest-facing chatbot.

      Data:
      \`\`\`json
      ${jsonString.substring(0, 100000)} 
      \`\`\`
      (Data truncated if too large)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze data.");
  }
};

export const auditStructureDeeply = async (data: HotelNode): Promise<string> => {
  try {
     const cleanData = generateCleanAIJSON(data);
     const jsonString = JSON.stringify(cleanData, null, 2);
     
     const prompt = `
      Act as a Senior Data Architect. Perform a deep structural audit of this JSON tree.
      The goal is to ensure this data is perfectly optimized for a RAG (Retrieval-Augmented Generation) system.
      
      Thinking Process:
      1. Analyze the hierarchy depth using the provided '_path' attributes.
      2. Check for semantic clarity in naming conventions.
      3. Evaluate if 'tags' and 'categories' are used effectively for filtering.
      
      Output a technical report on the data health.

      Data:
      \`\`\`json
      ${jsonString.substring(0, 100000)}
      \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 16000 },
      }
    });

    return response.text || "No audit generated.";
  } catch (error) {
    console.error("Gemini Deep Audit Error:", error);
    throw new Error("Failed to perform deep audit.");
  }
}

export const chatWithData = async (data: HotelNode, userMessage: string, history: {role: string, parts: string[]}[]): Promise<string> => {
  try {
    // OPTIMIZATION: 
    // 1. Generate clean JSON with injected '_path' context (e.g. "Hotel > Dining > Main Restaurant")
    // 2. This reduces token usage significantly and helps AI understand hierarchy without complex traversal logic.
    const cleanData = generateCleanAIJSON(data);
    const jsonContext = JSON.stringify(cleanData, null, 2).substring(0, 1000000); 
    
    // --- TEMPORAL ALGORITHM INJECTION ---
    const now = new Date();
    
    const temporalContext = {
        fullDate: now.toLocaleString('en-US', { dateStyle: 'full' }), 
        currentTime: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
        currentDay: now.toLocaleDateString('en-US', { weekday: 'long' }), 
        currentYear: now.getFullYear(),
    };

    const systemInstruction = `
      You are an Advanced Hotel Guest Assistant powered by a real-time JSON Database.
      
      *** TEMPORAL AWARENESS MODULE (ACTIVE) ***
      - **Current Date:** ${temporalContext.fullDate}
      - **Current Time:** ${temporalContext.currentTime} (24-Hour Format)
      - **Current Day:** ${temporalContext.currentDay}
      
      YOUR CORE MISSION:
      Answer the user's questions by finding the exact information in the provided JSON Hotel Database.
      
      DATA STRUCTURE NOTES:
      - The JSON data is hierarchical. 
      - Each item has a **'_path'** attribute (e.g., "Dining > Italian Restaurant > Pizza") to help you understand where it belongs.
      
      CRITICAL DATA ACCESS ALGORITHMS:
      
      1. **TIME-SENSITIVE QUERIES ("Now", "Currently"):**
         - Compare **Current Time (${temporalContext.currentTime})** against 'startTime' and 'endTime'.
         - Logic: If Current Time is within range, it is OPEN.
      
      2. **EVENT SCHEDULE LOGIC:**
         - **Weekly:** Check if 'days' array contains **${temporalContext.currentDay}**.
         - **Status:** If 'eventStatus' is 'cancelled', explicitly tell the user.

      3. **AUDIENCE & TAGS:**
         - Use 'targetAudience' (kids, adults) and 'tags' to filter relevant results.
      
      FORMATTING RULES:
      - Use **Bold** for names, prices, times, and status.
      - Be conversational but concise.
      
      HOTEL DATABASE (JSON):
      ${jsonContext}
    `;

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
      },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.parts[0] }] }))
    });

    const result = await chat.sendMessage({ message: userMessage });
    return result.text || "I'm not sure how to answer that.";

  } catch (error) {
    console.error("Chat Error:", error);
    return "I'm having trouble accessing the hotel database right now.";
  }
};

export const processArchitectCommand = async (data: HotelNode, userCommand: string): Promise<ArchitectResponse> => {
  try {
    const cleanData = generateCleanAIJSON(data);
    const jsonContext = JSON.stringify(cleanData, null, 2).substring(0, 200000);
    
    const prompt = `
      You are the "AI Architect" for this Hotel CMS. Your job is to modify the JSON structure based on natural language commands.
      
      User Command: "${userCommand}"
      
      Current Data Structure:
      \`\`\`json
      ${jsonContext}
      \`\`\`

      Task:
      1. Analyze the command.
      2. Find the most appropriate location in the JSON tree to Add, Update, or Delete data.
      3. Return a JSON object strictly adhering to the schema below.
      
      Schema:
      {
        "summary": "A short natural language explanation of what you are changing and why.",
        "actions": [
          {
            "type": "add" | "update" | "delete",
            "targetId": "ID of the parent node (for add) or the node itself (for update/delete)",
            "data": { ...object content... }, 
            "reason": "Technical reason for this specific action"
          }
        ]
      }

      Rules:
      - When adding, generate a reasonable ID and choose the correct 'type'.
      - Use the '_path' attribute in the data to understand the context of where to add/modify items.
      - Return ONLY raw JSON. No markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as ArchitectResponse;

  } catch (error) {
    console.error("Architect Error:", error);
    throw new Error("The Architect could not process your request.");
  }
};

export const processArchitectFile = async (data: HotelNode, fileBase64: string, mimeType: string): Promise<ArchitectResponse> => {
  try {
    const cleanData = generateCleanAIJSON(data);
    const jsonContext = JSON.stringify(cleanData, null, 2).substring(0, 200000);

    // Multimodal prompt construction
    const prompt = `
      You are the "AI Architect" for a Hotel CMS.
      
      Input 1: The current HOTEL DATABASE (JSON Structure).
      Input 2: An attached FILE (PDF, Image, or Text).

      YOUR GOAL:
      Read the FILE, understand its content, and map it into the JSON DATABASE.
      
      STRATEGY:
      1. Analyze the File content.
      2. Look at the JSON '_path' fields to find the right category (e.g. "Dining > Main Restaurant").
      3. Decision: Add items to existing categories or create new ones under Root.
      4. Structure: Convert unstructured text (e.g., "Burger - $10") into structured Nodes (type: 'menu_item', name: 'Burger', price: '10').

      OUTPUT:
      Return a JSON object with a list of actions (add/update).

      Schema:
      {
        "summary": "Explain what you found in the file and where you are putting it.",
        "actions": [
          {
            "type": "add" | "update",
            "targetId": "Parent ID to add to",
            "data": { "type": "menu_item", "name": "...", "value": "...", "price": "...", "tags": [...] },
            "reason": "Why this node belongs here"
          }
        ]
      }
      
      Current Data Structure:
      \`\`\`json
      ${jsonContext}
      \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: fileBase64
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as ArchitectResponse;

  } catch (error) {
    console.error("Architect File Error:", error);
    throw new Error("Failed to process the uploaded file.");
  }
};

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
  try {
    const cleanData = generateCleanAIJSON(data);
    const jsonContext = JSON.stringify(cleanData, null, 2).substring(0, 300000);

    const prompt = `
  You are the "Lead Data Architect & AI Logic Validator" for a Hotel CMS.
  
  INPUT CONTEXT:
  This data is a hierarchical tree representing a hotel (Rooms, Dining, Events).
  
  CRITICAL AUDIT RULES:
  1. **SEMANTIC AMBIGUITY:** Nodes named generically without descriptions.
  2. **LOGICAL FALLACIES:** End time before start time, minAge > maxAge.
  3. **ORPHANED DATA:** Menu items outside menus.
  
  TASK:
  Analyze the provided JSON structure and return a JSON report.
  Use the '_path' attribute to understand where nodes are located.

  IMPORTANT CONSTRAINTS:
  - **LIMIT REPORT TO TOP 50 ISSUES MAX.**
  - Prioritize "Critical" and "Warning" severity.
  - Return STRICT JSON.

  OUTPUT SCHEMA (Strict JSON):
  {
    "score": number, // 0-100.
    "summary": "A concise technical summary.",
    "issues": [
      {
        "id": "unique_issue_id",
        "nodeId": "id_of_node",
        "nodeName": "name_of_node",
        "severity": "critical" | "warning" | "optimization",
        "message": "Explanation.",
        "fix": {
          "targetId": "id_of_node",
          "action": "update",
          "data": { "key": "value" },
          "description": "Fix Label"
        }
      }
    ]
  }

  DATA TO AUDIT:
  \`\`\`json
  ${jsonContext}
  \`\`\`
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    let text = response.text || "{}";
    if (text.includes("```")) {
       text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    return JSON.parse(text) as HealthReport;

  } catch (error) {
    console.error("Health Audit Error:", error);
    throw new Error("Failed to generate health report.");
  }
};

export const generateNodeContext = async (node: HotelNode): Promise<NodeContextPrediction> => {
  try {
    // For single node context, we just strip basic fields manually as it's small enough.
    // NOTE: We don't need cleanJSON for a single node metadata generation, keeps latency lower.
    const nodePreview = {
      type: node.type,
      name: node.name,
      value: node.value,
      price: node.price,
      isPaid: node.isPaid
    };

    const prompt = `
      You are an AI Data Assistant optimizing a Hotel CMS.
      Your goal is to generate metadata that helps a Chatbot understand this data node.
      
      Node Data:
      \`\`\`json
      ${JSON.stringify(nodePreview, null, 2)}
      \`\`\`

      Tasks:
      1. Generate 5-8 "Semantic Tags".
      2. Write a short "Internal Note" (Description).

      Output JSON Schema:
      {
        "tags": ["string", "string"],
        "description": "string"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as NodeContextPrediction;
  } catch (error) {
    console.error("Context Gen Error:", error);
    throw new Error("Failed to generate context.");
  }
};

export const runDataCheck = async (
  data: HotelNode, 
  inputType: 'url' | 'text' | 'file', 
  inputValue: string, 
  mimeType?: string
): Promise<DataComparisonReport> => {
  try {
    const cleanData = generateCleanAIJSON(data);
    const jsonContext = JSON.stringify(cleanData, null, 2).substring(0, 200000);
    
    let tools: any[] = [];
    let contents = [];

    const basePrompt = `
      You are a meticulous Data Auditor for a Hotel CMS.
      Your goal is to COMPARE the Internal Database (JSON) against an External Data Source.

      Internal Database (Cleaned):
      \`\`\`json
      ${jsonContext}
      \`\`\`
      
      Task:
      Compare the Internal Database against the External Source.
      Identify Matches, Conflicts, Missing Internal Data, and Missing External Data.

      CRITICAL FEATURE:
      For 'conflict' and 'missing_internal' items, you MUST provide a 'suggestedAction' object.

      IMPORTANT: Return the result STRICTLY in the following JSON Schema.

      Schema:
      {
        "summary": "A brief overview of the comparison results.",
        "items": [
          {
            "id": "unique_id",
            "category": "match" | "conflict" | "missing_internal" | "missing_external",
            "field": "Name of the item/field",
            "internalValue": "Value in DB",
            "externalValue": "Value in External Source",
            "description": "Short explanation.",
            "suggestedAction": {
              "type": "add" | "update",
              "targetId": "ID of parent (for add) or node (for update)",
              "data": { "name": "...", "value": "...", "type": "item", ... }
            }
          }
        ]
      }
    `;

    if (inputType === 'url') {
      tools = [{ googleSearch: {} }];
      contents = [{ text: `${basePrompt}\n\nExternal Source URL: ${inputValue}\nPlease search specifically for this URL and compare its content against my database.` }];
    } else if (inputType === 'file') {
      contents = [
        { text: basePrompt },
        { inlineData: { mimeType: mimeType || 'application/pdf', data: inputValue } }
      ];
    } else {
      contents = [{ text: `${basePrompt}\n\nExternal Source Text:\n"${inputValue}"` }];
    }

    const config: any = {};
    if (tools.length > 0) {
        config.tools = tools;
    } else {
        config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: config
    });

    let text = response.text || "{}";
    if (text.includes("```")) {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    return JSON.parse(text) as DataComparisonReport;

  } catch (error) {
    console.error("Data Check Error:", error);
    throw new Error("Failed to perform data check.");
  }
};

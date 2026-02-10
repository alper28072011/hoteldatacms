
import { GoogleGenAI } from "@google/genai";
import { HotelNode, ArchitectResponse, HealthReport, DataComparisonReport } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeHotelData = async (data: HotelNode): Promise<string> => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
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
     const jsonString = JSON.stringify(data, null, 2);
     const prompt = `
      Act as a Senior Data Architect. Perform a deep structural audit of this JSON tree.
      The goal is to ensure this data is perfectly optimized for a RAG (Retrieval-Augmented Generation) system.
      
      Thinking Process:
      1. Analyze the hierarchy depth.
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
    // Increased limit significantly to utilize Gemini's large context window.
    const jsonContext = JSON.stringify(data, null, 2).substring(0, 1000000); 
    
    // --- TEMPORAL ALGORITHM INJECTION ---
    const now = new Date();
    
    // Formatting time for AI comprehension
    const temporalContext = {
        fullDate: now.toLocaleString('en-US', { dateStyle: 'full' }), // e.g. "Monday, October 27, 2023"
        currentTime: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), // "14:30" (24h format for easy comparison)
        currentDay: now.toLocaleDateString('en-US', { weekday: 'long' }), // "Monday"
        currentYear: now.getFullYear(),
        nextYear: now.getFullYear() + 1
    };

    const systemInstruction = `
      You are an Advanced Hotel Guest Assistant powered by a real-time JSON Database.
      
      *** TEMPORAL AWARENESS MODULE (ACTIVE) ***
      You are aware of the current time and date. Use this to answer temporal questions.
      - **Current Date:** ${temporalContext.fullDate}
      - **Current Time:** ${temporalContext.currentTime} (24-Hour Format)
      - **Current Day:** ${temporalContext.currentDay}
      - **Current Year:** ${temporalContext.currentYear}
      
      YOUR CORE MISSION:
      Answer the user's questions by finding the exact information in the provided JSON Hotel Database.
      
      CRITICAL DATA ACCESS ALGORITHMS:
      
      1. **TIME-SENSITIVE QUERIES ("Now", "Currently"):**
         - If user asks "Where can I eat *now*?" or "Is the pool open?", you MUST compare the **Current Time (${temporalContext.currentTime})** against the 'startTime' and 'endTime' fields in the JSON.
         - Logic: If Current Time >= startTime AND Current Time <= endTime, then it is OPEN. Otherwise, it is CLOSED.
         - If a place is closed, kindly tell the user when it opens next based on 'startTime'.

      2. **EVENT SCHEDULE LOGIC (Complex Recurrence):**
         - **Weekly Events:** If 'recurrenceType' is 'weekly', check if the 'days' array contains **${temporalContext.currentDay}**.
         - **Bi-Weekly Events (Every 2 Weeks):** 
             - Look for 'validFrom' date. 
             - Calculate the number of weeks between 'validFrom' and **${temporalContext.fullDate}**.
             - If the week difference is EVEN (0, 2, 4...), and the Current Day is in 'days', the event IS happening this week.
             - If the week difference is ODD, the event is NOT happening this week (it's next week).
         - **Date Ranges:** Ensure Current Date is between 'validFrom' and 'validUntil'.
         - **Status:** If 'eventStatus' is 'cancelled', explicitly tell the user: "Usually on Tuesdays, but cancelled for today."

      3. **AUDIENCE FILTERING:**
         - If user asks for "Kids activities": Filter for nodes where 'targetAudience' is 'kids' OR 'family'.
         - If user asks for "Adults": Filter for 'targetAudience' is 'adults' OR 'minAge' >= 18.
         - If user mentions their child's age (e.g., "for my 5 year old"), check 'minAge' and 'maxAge'.

      4. **Deep Tree Traversal**: 
         - The data is a nested tree. Recursively search 'children' arrays.
      
      5. **Tag Matching**: 
         - Use 'tags' array to match intent (e.g. "Food" -> 'Dining', 'Snack').
      
      FORMATTING RULES:
      - Use **Bold** for names, prices, times, and status (e.g. **OPEN**, **CLOSED**).
      - Be conversational. If something is closed, say: "The **Pool** is currently **CLOSED**. It opens at **08:00**."
      
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
    const jsonContext = JSON.stringify(data, null, 2).substring(0, 200000);
    
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
      - If adding a node, ensure you generate a reasonable ID (e.g., "snack-bar-fries") and choose the correct 'type' (e.g., 'menu_item', 'field', 'item').
      - If the user refers to a node by name (e.g., "Snack Bar"), find its ID in the provided JSON.
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
    const jsonContext = JSON.stringify(data, null, 2).substring(0, 200000);

    // Multimodal prompt construction
    const prompt = `
      You are the "AI Architect" for a Hotel CMS.
      
      Input 1: The current HOTEL DATABASE (JSON Structure).
      Input 2: An attached FILE (PDF, Image, or Text) containing unstructured hotel data (menus, rules, info).

      YOUR GOAL:
      Read the FILE, understand its content, and map it into the JSON DATABASE.
      
      STRATEGY:
      1. Analyze the File: What is it? A spa menu? A room service list? Pool rules?
      2. Find Context: Look at the JSON. Is there already a category for this? (e.g. if file is "Spa Menu", look for "Spa" category).
      3. Decision:
         - If the category exists -> Add items to it.
         - If not -> Create the category under the Root or appropriate parent, then add items.
      4. Structure: Convert unstructured text (e.g., "Burger - $10") into structured Nodes (type: 'menu_item', name: 'Burger', price: '10').

      OUTPUT:
      Return a JSON object with a list of actions (add/update) to merge this file into the database.

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

// --- DATA HEALTH AUDITOR ---

export const generateHealthReport = async (data: HotelNode): Promise<HealthReport> => {
  try {
    const jsonContext = JSON.stringify(data, null, 2).substring(0, 300000);

    const prompt = `
      You are a Senior Data Health Auditor for a generic Hotel CMS.
      Analyze the provided JSON data structure for Semantic Health, Completeness, and AI-Readiness.

      Audit Rules:
      1. CRITICAL: Identify nodes that need specific boolean flags but lack them (e.g., a "Wine" item without 'isPaid': true).
      2. WARNING: Identify nodes with ambiguous names (e.g. "Pool" -> better is "Outdoor Pool" or "Kids Pool").
      3. WARNING: Identify 'Category' nodes that are missing 'description'. Descriptions help the AI traverse the tree.
      4. OPTIMIZATION: Suggest 'tags' for items that lack them but have obvious categories (e.g., A 'Burger' item should have tags ['Food', 'Lunch', 'Dinner']).
      5. CRITICAL: Check for missing critical values in 'menu_item' (price) or 'event' (startTime).

      Task:
      Generate a Health Report in JSON format strictly adhering to the schema below.

      Schema:
      {
        "score": number, // 0 to 100 integer. 100 is perfect.
        "summary": "A 1-sentence summary of the data health.",
        "issues": [
          {
            "id": "unique_issue_id",
            "nodeId": "id_of_node",
            "nodeName": "name_of_node",
            "severity": "critical" | "warning" | "optimization",
            "message": "Short explanation of the issue",
            "fix": {
              "targetId": "id_of_node",
              "action": "update",
              "data": { "fieldToUpdate": "newValue" }, // Only include the fields that need changing. e.g. { "tags": ["Food"] }
              "description": "Short label for the button, e.g. 'Add Tags'"
            }
          }
        ]
      }

      Data:
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

    const text = response.text || "{}";
    return JSON.parse(text) as HealthReport;

  } catch (error) {
    console.error("Health Audit Error:", error);
    throw new Error("Failed to generate health report.");
  }
};

// --- CONTEXT GENERATOR ---

export interface NodeContextPrediction {
  tags: string[];
  description: string;
}

export const generateNodeContext = async (node: HotelNode): Promise<NodeContextPrediction> => {
  try {
    // We send a stripped down version of the node to focus the AI on the content
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
      1. Generate 5-8 "Semantic Tags". These should be synonyms, categories, or related concepts a user might ask about. (e.g. for "Burger": ["Food", "Lunch", "Dinner", "Snack", "Meat", "American Cuisine"]).
      2. Write a short "Internal Note" (Description). Explain clearly what this data is to an AI. (e.g. "This is a paid menu item available at the restaurant.").

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

// --- DATA CHECK / COMPARISON MODULE ---

export const runDataCheck = async (
  data: HotelNode, 
  inputType: 'url' | 'text' | 'file', 
  inputValue: string, // URL string, Text content, or Base64 string
  mimeType?: string // For file mode
): Promise<DataComparisonReport> => {
  try {
    const jsonContext = JSON.stringify(data, null, 2).substring(0, 200000);
    
    // Config based on input type
    let tools: any[] = [];
    let contents = [];

    const basePrompt = `
      You are a meticulous Data Auditor for a Hotel CMS.
      Your goal is to COMPARE the Internal Database (JSON) against an External Data Source.

      Internal Database:
      \`\`\`json
      ${jsonContext}
      \`\`\`
      
      Task:
      Compare the Internal Database against the External Source.
      Identify:
      1. **Matches**: Data that exists in both and is consistent.
      2. **Conflicts**: Data that exists in both but has different values (e.g. Database says Pool closes at 8pm, Website says 10pm).
      3. **Missing Internal**: Data found in the External Source that is NOT in the Database (This is an opportunity to update the DB).
      4. **Missing External**: Data found in the Database that is NOT in the External Source (The external source might be incomplete).

      CRITICAL FEATURE:
      For 'conflict' and 'missing_internal' items, you MUST provide a 'suggestedAction' object.
      - If 'missing_internal': suggest adding a new node. Find the best Parent ID in the tree (or default to 'root'). Construct the 'data' object for the new node.
      - If 'conflict': suggest updating the existing node with the external value.

      IMPORTANT: Return the result STRICTLY in the following JSON Schema. Do not include markdown formatting like \`\`\`json.

      Schema:
      {
        "summary": "A brief overview of the comparison results.",
        "items": [
          {
            "id": "unique_id",
            "category": "match" | "conflict" | "missing_internal" | "missing_external",
            "field": "Name of the item/field (e.g. 'Pool Hours')",
            "internalValue": "Value in DB (or null)",
            "externalValue": "Value in External Source (or null)",
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
      // URL Mode: Use Google Search Grounding
      tools = [{ googleSearch: {} }];
      contents = [{ text: `${basePrompt}\n\nExternal Source URL: ${inputValue}\nPlease search specifically for this URL and compare its content against my database.` }];
    } else if (inputType === 'file') {
      // File Mode: Multimodal
      contents = [
        { text: basePrompt },
        { inlineData: { mimeType: mimeType || 'application/pdf', data: inputValue } }
      ];
    } else {
      // Text Mode
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
    
    // Cleanup potential markdown if tools were used (since strict JSON mode was off)
    if (text.includes("```")) {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    return JSON.parse(text) as DataComparisonReport;

  } catch (error) {
    console.error("Data Check Error:", error);
    throw new Error("Failed to perform data check.");
  }
};

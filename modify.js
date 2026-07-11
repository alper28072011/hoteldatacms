import fs from 'fs';
let data = fs.readFileSync('services/geminiService.ts', 'utf8');

// Replace modelConfig.model with currentModel
data = data.replace(/modelConfig\.model/g, 'currentModel');

// Introduce a generate call wrapper to track usage
// Let's replace `ai.models.generateContent({` with `wrappedGenerateContent({`
data = data.replace(/ai\.models\.generateContent\(\{/g, 'wrappedGenerateContent({');

// Add wrappedGenerateContent at the top
const wrapper = `
const wrappedGenerateContent = async (req: any) => {
  const result = await ai.models.generateContent(req);
  if (result.usageMetadata) trackTokenUsage(result.usageMetadata);
  return result;
};
`;
data = data.replace('export const translateText', wrapper + '\nexport const translateText');

// Replace chat.sendMessage
data = data.replace(/await chat\.sendMessage\(\{ message: (.+?) \}\);/g, 'await chat.sendMessage({ message: $1 });\n    if (result.usageMetadata) trackTokenUsage(result.usageMetadata);');

fs.writeFileSync('services/geminiService.ts', data);

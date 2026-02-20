

export type NodeType = 'root' | 'category' | 'item' | 'field' | 'list' | 'menu' | 'menu_item' | 'event' | 'qa_pair' | 'policy' | 'note';

// Legacy SchemaType kept for backward compatibility but deprecated in UI
export type SchemaType = 'generic' | 'event' | 'dining' | 'room' | 'pool' | 'bar';

// --- INTENT-DRIVEN ARCHITECTURE ---
export type IntentType = 'informational' | 'request' | 'policy' | 'complaint' | 'safety' | 'navigation';

// --- MULTI-LANGUAGE SUPPORT ---
export interface LocalizedText {
  tr: string;
  en: string;
  [key: string]: string; 
}

export interface ScheduleConfig {
  frequency: 'once' | 'daily' | 'weekly' | 'biweekly';
  validFrom?: string; 
  validUntil?: string; 
  activeDays: string[]; 
  cycleAnchorDate?: string; 
  startTime: string; 
  endTime?: string; 
  excludedDates?: string[]; 
}

export interface EventData {
  schedule: ScheduleConfig;
  location: string;
  ageGroup: 'all' | 'adults' | 'kids' | 'teens';
  minAge?: number;
  status: 'active' | 'cancelled' | 'moved';
  statusReason?: string; 
  isPaid: boolean;
  price?: string;
  currency?: string;
  requiresReservation: boolean;
  performer?: string; 
  description?: string; 
  tags: string[]; 
}

export interface DiningData {
  type: 'buffet' | 'alacarte' | 'snack' | 'patisserie';
  cuisine: string; 
  concept: 'all_inclusive' | 'extra_charge' | 'mixed'; 
  reservationRequired: boolean;
  dressCode: string;
  shifts: { name: string; start: string; end: string }[]; 
  features: {
    hasKidsMenu: boolean;
    hasVeganOptions: boolean;
    hasGlutenFreeOptions: boolean;
    hasBabyChair: boolean;
    hasTerrace: boolean;
  };
  menuHighlights: string[]; 
  beverageHighlights: string[]; 
}

export interface RoomData {
  sizeSqM: number;
  maxOccupancy: { adults: number; children: number; total: number };
  bedConfiguration: string; 
  pillowMenuAvailable: boolean;
  view: 'sea' | 'land' | 'garden' | 'pool' | 'partial_sea';
  hasBalcony: boolean;
  hasJacuzzi: boolean;
  amenities: string[]; 
  minibarContent: string[]; 
  bathroomDetails: string; 
}

// --- DYNAMIC TEMPLATES & ATTRIBUTES ---

export type FieldType = 
  | 'text'        // Short text (Name, Title)
  | 'textarea'    // Long text (Description, Ingredients)
  | 'number'      // Integers/Floats (SqM, Capacity)
  | 'boolean'     // Toggle (Has Balcony, Is Paid)
  | 'select'      // Single choice dropdown
  | 'multiselect' // Multiple tags
  | 'date'        // Calendar date
  | 'time'        // Clock time
  | 'currency';   // Price field

export interface NodeAttribute {
  id: string;
  key: LocalizedText | string; 
  value: LocalizedText | string; 
  type: FieldType;
  options?: string[]; 
  // Nested attributes for conditional logic (e.g. Jacuzzi: Yes -> Type: Outdoor)
  subAttributes?: NodeAttribute[]; 
}

export interface LocalizedOptions {
  tr: string[];
  en: string[];
}

export interface TemplateField {
  id: string;
  key: string; // Machine key (e.g. 'opening_time')
  label: LocalizedText; // Display label (e.g. TR: 'Açılış Saati')
  type: FieldType;
  
  // Updated for Localization support
  options?: LocalizedOptions | string[]; // Backwards compatible with string[]
  
  required: boolean;
  aiDescription?: LocalizedText | string; // Updated for Localization support
  
  // Conditional Logic
  condition?: {
      triggerValue: string; // e.g. "true" (When parent is true...)
      fields: TemplateField[]; // ...show these fields
  };
}

export interface NodeTemplate {
  id: string;
  name: string; 
  description?: string;
  fields: TemplateField[];
}

export interface HotelNode {
  id: string;
  type: NodeType | string;
  
  name?: LocalizedText | string;
  intent?: IntentType;

  // Deprecated usage in favor of Template System, but kept for compatibility
  schemaType?: SchemaType; 
  data?: any; 

  appliedTemplateId?: string | null;

  value?: LocalizedText | string; 
  description?: LocalizedText | string; 
  
  attributes?: NodeAttribute[];
  children?: HotelNode[];
  
  price?: string | number | null;
  tags?: string[];
  question?: string;
  answer?: LocalizedText | string;
  
  // New Fields for AI Data Blindness Prevention
  aiConfidence?: number; // 0-100 score of how well AI understands this node
  aiIssues?: string[]; // Reasons for low confidence (e.g. "Missing Unit", "Ambiguous Key")

  lastSaved?: number;
  lastModified?: number; // Granular update tracking per node
  [key: string]: any;
}

export interface HotelSummary {
  id: string;
  name: string;
}

export interface HotelTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  data: HotelNode; 
}

export interface AIPersona {
  id: string;
  name: string;        
  role: string;        
  tone: string;        
  languageStyle: string; 
  instructions: string[]; 
  creativity: number;  
}

export interface AIResponse {
  type: 'success' | 'error' | 'loading';
  message: string;
  content?: string;
}

export interface SimulationResponse {
  answer: string; // The chat response
  intent: string; // "Inquiry", "Complaint", etc.
  dataHealth: 'good' | 'missing_info' | 'ambiguous' | 'hallucination_risk';
  analysis: string; // "I found this data at Path > Node..."
  blindness: string; // "Attribute 'Area' has no unit."
  suggestion?: string; // "Add 'Unit' to attribute."
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  analysis?: SimulationResponse; // Optional structured data for AI messages
  timestamp: Date;
  isThinking?: boolean;
}

export interface ArchitectAction {
  type: 'add' | 'update' | 'delete';
  targetId: string; 
  data?: Partial<HotelNode>; 
  reason?: string;
}

export interface ArchitectResponse {
  summary: string;
  actions: ArchitectAction[];
}

export type IssueSeverity = 'critical' | 'warning' | 'optimization';

export interface HealthFix {
  targetId: string;
  action: 'update'; 
  data: Partial<HotelNode>;
  description: string;
}

export interface HealthIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  severity: IssueSeverity;
  message: string;
  fix?: HealthFix;
}

export interface HealthReport {
  score: number; 
  summary: string;
  issues: HealthIssue[];
  nodeScores?: Record<string, number>; // New: Score map by NodeID
}

export interface SuggestedAction {
  type: 'add' | 'update';
  targetId: string; 
  data: Partial<HotelNode>;
}

export interface ComparisonItem {
  id: string;
  category: 'match' | 'conflict' | 'missing_internal' | 'missing_external';
  field: string;
  internalValue: string | null;
  externalValue: string | null;
  description: string;
  suggestedAction?: SuggestedAction; 
}

export interface DataComparisonReport {
  summary: string;
  sourceUrl?: string;
  items: ComparisonItem[];
}

export interface NodeContextPrediction {
  tags: string[];
  description: string;
}
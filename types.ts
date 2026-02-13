
export type NodeType = 'root' | 'category' | 'item' | 'field' | 'list' | 'menu' | 'menu_item' | 'event' | 'qa_pair' | 'policy' | 'note';

export type SchemaType = 'generic' | 'event' | 'dining' | 'room' | 'pool';

// --- SCHEMA DEFINITIONS ---

export interface EventData {
  scheduleType: 'daily' | 'weekly' | 'once';
  days: string[]; // ['Mon', 'Tue']
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  location: string;
  ageMin: number;
  ageMax: number;
  isPaid: boolean;
  price?: string;
  requiresReservation: boolean;
  dressCode?: string;
}

export interface DiningData {
  cuisine: string; // "Italian", "Buffet"
  mealType: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  openingTime: string;
  closingTime: string;
  dressCode: string;
  reservationRequired: boolean;
  isPaid: boolean;
  priceRange?: 'Low' | 'Medium' | 'High';
}

export interface RoomData {
  sizeSqM: number;
  bedType: string; // "King", "Twin"
  maxOccupancy: number;
  view: string; // "Sea", "Garden"
  hasBalcony: boolean;
  amenities: string[]; // ["Wifi", "Minibar", "Safe"]
}

export interface NodeAttribute {
  id: string;
  key: string; 
  value: string; 
  type: 'text' | 'boolean' | 'number' | 'select';
  options?: string[]; 
}

export interface HotelNode {
  id: string;
  type: NodeType | string;
  name?: string;
  
  // NEW: SCHEMA AWARENESS
  schemaType?: SchemaType; 
  data?: EventData | DiningData | RoomData | any; // Structured payload based on schemaType

  // PRIMARY CONTENT
  value?: string; // Main description or generated summary
  description?: string; // Internal AI notes / Context
  
  // DYNAMIC ATTRIBUTES
  attributes?: NodeAttribute[];
  
  // HIERARCHY
  children?: HotelNode[];
  
  // LEGACY FIELDS (Kept for backward compatibility)
  price?: string | number | null;
  tags?: string[];
  question?: string;
  answer?: string;
  
  // Metadata fields
  lastSaved?: number; 
  [key: string]: any;
}

// New type for listing hotels without fetching full tree
export interface HotelSummary {
  id: string;
  name: string;
}

// Template definition
export interface HotelTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  data: HotelNode; // The structural snapshot
}

// AI Persona Definition
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

// AI Architect Types
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

// --- DATA HEALTH TYPES ---

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
  score: number; // 0-100
  summary: string;
  issues: HealthIssue[];
}

// --- DATA CHECK TYPES ---

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

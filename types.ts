
export type NodeType = 'root' | 'category' | 'item' | 'field' | 'list' | 'menu' | 'menu_item' | 'event' | 'qa_pair' | 'policy' | 'note';

export interface NodeAttribute {
  id: string;
  key: string; // e.g., "Price", "Working Hours"
  value: string; // e.g., "100$", "09:00 - 18:00"
  type: 'text' | 'boolean' | 'number' | 'select';
  options?: string[]; // For select type
}

export interface HotelNode {
  id: string;
  type: NodeType | string;
  name?: string;
  
  // PRIMARY CONTENT
  value?: string; // Main description or value
  description?: string; // Internal AI notes / Context
  
  // DYNAMIC ATTRIBUTES (The new flexible structure)
  attributes?: NodeAttribute[];
  
  // HIERARCHY
  children?: HotelNode[];
  
  // LEGACY / SPECIFIC FIELDS (Kept for backward compatibility but mapped to attributes in UI)
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'specific_date';
  validFrom?: string; 
  validUntil?: string; 
  startTime?: string; 
  endTime?: string; 
  days?: string[]; 
  eventStatus?: 'active' | 'cancelled' | 'postponed' | 'full';
  location?: string; 
  targetAudience?: 'all' | 'adults' | 'kids' | 'teens' | 'couples' | 'family';
  minAge?: number;
  maxAge?: number;
  isExternalAllowed?: boolean;
  requiresReservation?: boolean;
  price?: string | number | null;
  calories?: string;
  isPaid?: boolean | null;
  isMandatory?: boolean | null;
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
  name: string;        // e.g. "Aggressive Sales"
  role: string;        // e.g. "Senior Sales Manager"
  tone: string;        // e.g. "Professional, Urgent, Persuasive"
  languageStyle: string; // e.g. "Formal Turkish", "Casual English"
  instructions: string[]; // Specific rules e.g. "Never mention competitors"
  creativity: number;  // 0.0 - 1.0 (Temperature)
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
  targetId: string; // parentId for 'add', nodeId for 'update'/'delete'
  data?: Partial<HotelNode>; // For add/update. For 'add', this is the new node.
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
  targetId: string; // ID of the parent (for add) or the node itself (for update)
  data: Partial<HotelNode>;
}

export interface ComparisonItem {
  id: string;
  category: 'match' | 'conflict' | 'missing_internal' | 'missing_external';
  field: string;
  internalValue: string | null;
  externalValue: string | null;
  description: string;
  suggestedAction?: SuggestedAction; // New field for actionable imports
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

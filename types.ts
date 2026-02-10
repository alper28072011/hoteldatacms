
export type NodeType = 'root' | 'category' | 'item' | 'field' | 'list' | 'menu' | 'menu_item' | 'event' | 'qa_pair' | 'policy';

export interface HotelNode {
  id: string;
  type: NodeType | string;
  name?: string;
  value?: string;
  description?: string;
  children?: HotelNode[];
  
  // --- EVENT & ACTIVITY SPECIFIC FIELDS ---
  
  // Timing & Recurrence
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'specific_date';
  validFrom?: string; // YYYY-MM-DD (Start of the season/schedule)
  validUntil?: string; // YYYY-MM-DD (End of the season)
  specificDate?: string; // YYYY-MM-DD (For one-time events)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  days?: string[]; // ["Mon", "Tue"] for weekly/biweekly
  
  // Status & Management
  eventStatus?: 'active' | 'cancelled' | 'postponed' | 'full';
  location?: string; // e.g., "Show Center", "Main Pool"
  
  // Audience & Restrictions
  targetAudience?: 'all' | 'adults' | 'kids' | 'teens' | 'couples' | 'family';
  minAge?: number;
  maxAge?: number;
  isExternalAllowed?: boolean;
  requiresReservation?: boolean;

  // Existing fields
  price?: string | number | null;
  calories?: string;
  isPaid?: boolean | null;
  isMandatory?: boolean | null;
  tags?: string[];
  eventType?: string;
  severity?: 'info' | 'warning' | 'error' | null;
  question?: string;
  answer?: string;
  
  // Metadata fields
  lastSaved?: number; // Timestamp (ms)
  
  // Allow flexibility
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

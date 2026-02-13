
export type NodeType = 'root' | 'category' | 'item' | 'field' | 'list' | 'menu' | 'menu_item' | 'event' | 'qa_pair' | 'policy' | 'note';

export type SchemaType = 'generic' | 'event' | 'dining' | 'room' | 'pool' | 'bar';

// --- ROBUST EVENT SCHEDULING ---

export interface ScheduleConfig {
  frequency: 'once' | 'daily' | 'weekly' | 'biweekly'; // biweekly = her 2 haftada bir
  
  // Sezonluk Geçerlilik (Örn: 1 Mayıs - 31 Ekim arası)
  validFrom?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  
  // Haftalık/İki Haftalık günler
  activeDays: string[]; // ['Mon', 'Thu']
  
  // İki haftalık döngü için referans tarihi (Hangi haftada olduğumuzu hesaplamak için)
  cycleAnchorDate?: string; // YYYY-MM-DD (Döngünün başladığı ilk Pazartesi)
  
  // Saatler
  startTime: string; // "21:30"
  endTime?: string; // "23:00"
  
  // İstisnalar (Örn: Yağmur nedeniyle iptal)
  excludedDates?: string[]; // ['2024-06-12']
}

export interface EventData {
  schedule: ScheduleConfig;
  location: string;
  
  // Hedef Kitle
  ageGroup: 'all' | 'adults' | 'kids' | 'teens';
  minAge?: number;
  
  // Durum
  status: 'active' | 'cancelled' | 'moved';
  statusReason?: string; // "Hava muhalefeti nedeniyle"
  
  // Finansal
  isPaid: boolean;
  price?: string;
  currency?: string;
  requiresReservation: boolean;
  
  // İçerik
  performer?: string; // "Fire of Anatolia"
  description?: string; // "Anadolu ateşinin büyüleyici dansı..."
  tags: string[]; // ['Dance', 'Show', 'Live Music']
}

// --- DINING & CULINARY ---

export interface DiningData {
  type: 'buffet' | 'alacarte' | 'snack' | 'patisserie';
  cuisine: string; // "Italian", "International", "Ottoman"
  
  // Konsept Detayları
  concept: 'all_inclusive' | 'extra_charge' | 'mixed'; // Mixed: Bazı içkiler ücretli
  reservationRequired: boolean;
  dressCode: string;
  
  // Öğün Saatleri (Array of shifts)
  shifts: { name: string; start: string; end: string }[]; // [{name: 'Breakfast', start: '07:00', end: '10:00'}]
  
  // Özellikler & Diyet
  features: {
    hasKidsMenu: boolean;
    hasVeganOptions: boolean;
    hasGlutenFreeOptions: boolean;
    hasBabyChair: boolean;
    hasTerrace: boolean;
  };
  
  menuHighlights: string[]; // ["Sushi", "Steak", "Fresh Pasta"]
  beverageHighlights: string[]; // ["Premium Whisky", "Fresh Orange Juice"]
}

// --- ROOM & ACCOMMODATION ---

export interface RoomData {
  sizeSqM: number;
  maxOccupancy: { adults: number; children: number; total: number };
  
  // Yatak Düzeni
  bedConfiguration: string; // "1 French + 1 Single"
  pillowMenuAvailable: boolean;
  
  // Manzara & Konum
  view: 'sea' | 'land' | 'garden' | 'pool' | 'partial_sea';
  hasBalcony: boolean;
  hasJacuzzi: boolean;
  
  // Teknik & İmkanlar
  amenities: string[]; // ["Espresso Machine", "Iron", "Smart TV", "High Speed Wifi"]
  minibarContent: string[]; // ["Coke", "Beer", "Water", "Chocolate"]
  bathroomDetails: string; // "Shower & Bathtub, Bulgari Amenities"
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

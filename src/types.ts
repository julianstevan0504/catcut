export type Page =
  | "overview"
  | "inbox"
  | "assistant"
  | "products"
  | "orders"
  | "activity"
  | "settings"
  | "restaurant"
  | "reservations"
  | "kitchen"
  | "support"
  | "platform";
export type KnowledgeDocument = { id: string; title: string; content: string };
export type Settings = {
  assistantName: string;
  active: boolean;
  tone: "cercano" | "profesional" | "entusiasta";
  description: string;
  timezone: string;
  hours: string;
  shipping: string;
  returns: string;
  payments: string;
  welcome: string;
  faqs: { id: string; question: string; answer: string }[];
  voiceEnabled?: boolean;
  voiceRate?: number;
  knowledge?: KnowledgeDocument[];
  rememberPreferences?: boolean;
};
export type Integration = {
  configured: boolean;
  phoneNumberId: string;
  displayPhone: string;
  status: string;
  webhookUrl: string;
};
export type Session = {
  offline?: boolean;
  platformAdmin?: boolean;
  businessState?: "active" | "suspended";
  persistence?: "browser" | "memory";
  csrfToken?: string;
  user: { id: string; name: string; email: string };
  workspace: { id: string; name: string; created_at: string };
  settings: Settings;
  integration: Integration;
  ai: { configured: boolean; model: string };
  demo: boolean;
};
export type Conversation = {
  id: string;
  name: string;
  phone: string;
  channel:
    | "demo"
    | "sandbox"
    | "whatsapp"
    | "voice-web"
    | "voice-test"
    | "voice-whatsapp"
    | "voice-phone";
  status: "open" | "pending" | "resolved";
  handoff: number;
  unread: number;
  topic: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_role: string | null;
};
export type Message = {
  id: string;
  role: "user" | "assistant" | "agent";
  text: string;
  source: string;
  status: string;
  created_at: string;
};
export type Product = {
  image_id?: string;
  image_url?: string;
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  ingredients?: string;
  allergens?: string;
  kind?: "product" | "dish" | "drink";
};
export type ReplyContext = {
  productIds?: string[];
  menuOffset?: number;
  discussedIds?: string[];
  budget?: number;
  quantity?: number;
  kind?: "product" | "dish" | "drink" | "all";
  lastIntent?: string;
  updatedAt?: string;
};
export type StoreReply = {
  text: string;
  category: string;
  source: string;
  handoff: boolean;
  productIds: string[];
  context: ReplyContext;
  policy: "grounded" | "outside" | "not-found" | "missing-data";
  sources?: { id: string; title: string }[];
  suggestions?: string[];
  approach?: string;
};
export type VoiceSession = {
  id: string;
  token: string;
  conversationId: string;
  greeting: string;
  expiresAt: string;
};
export type Order = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  status: string;
  total: number;
  items: string;
  tracking_number: string;
  tracking_url: string;
  created_at: string;
  updated_at: string;
};
export type Activity = {
  id: string;
  action: string;
  description: string;
  actor: string;
  created_at: string;
};
export type DashboardData = {
  metrics: {
    conversations: number;
    automatic: number;
    waiting: number;
    resolved: number;
    messages: number;
    products: number;
  };
  graph: { date: string; count: number }[];
  recentConversations: Conversation[];
  activities: Activity[];
  lowStock: { id: string; name: string; stock: number }[];
};

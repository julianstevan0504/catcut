export type Page = 'overview' | 'inbox' | 'assistant' | 'products' | 'orders' | 'activity' | 'settings';
export type Settings = {
  assistantName: string; active: boolean; tone: 'cercano' | 'profesional' | 'entusiasta'; description: string;
  timezone: string; hours: string; shipping: string; returns: string; payments: string; welcome: string;
  faqs: { id: string; question: string; answer: string }[];
};
export type Integration = { configured: boolean; phoneNumberId: string; displayPhone: string; status: string; webhookUrl: string };
export type Session = {
  user: { id: string; name: string; email: string }; workspace: { id: string; name: string; created_at: string };
  settings: Settings; integration: Integration; ai: { configured: boolean; model: string }; demo: boolean;
};
export type Conversation = {
  id: string; name: string; phone: string; channel: 'demo' | 'sandbox' | 'whatsapp';
  status: 'open' | 'pending' | 'resolved'; handoff: number; unread: number; topic: string;
  created_at: string; updated_at: string; last_message: string | null; last_role: string | null;
};
export type Message = { id: string; role: 'user' | 'assistant' | 'agent'; text: string; source: string; status: string; created_at: string };
export type Product = { id: string; name: string; sku: string; description: string; category: string; price: number; stock: number; color: string };
export type Order = { id: string; code: string; customer: string; phone: string; status: string; total: number; items: string; tracking_number: string; tracking_url: string; created_at: string; updated_at: string };
export type Activity = { id: string; action: string; description: string; actor: string; created_at: string };
export type DashboardData = {
  metrics: { conversations: number; automatic: number; waiting: number; resolved: number; messages: number; products: number };
  graph: { date: string; count: number }[]; recentConversations: Conversation[]; activities: Activity[];
  lowStock: { id: string; name: string; stock: number }[];
};

import { AdminRole } from '../core/models/admin.models';

export type SupportTicketStatus = 'open' | 'resolved' | 'pending';

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SupportMessageAuthor = 'user' | 'admin' | 'ai';

export type SupportContextType = 'destination' | 'place' | 'activity' | 'event';

export interface SupportTicketContext {
  type: SupportContextType;
  id: string;
  name: string;
  route: string;
  thumbnailUrl: string | null;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  author: SupportMessageAuthor;
  authorName: string;
  content: string;
  createdAt: string;
  isInternal: boolean;
}

export interface SupportConversation {
  id: string;
  ticketNumber: string;
  userName: string;
  userInitials: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  context: SupportTicketContext | null;
}

export interface SupportTicket extends SupportConversation {
  messages: SupportMessage[];
  assignedToRole: AdminRole;
  region: string | null;
  placeOwnerId: string | null;
}

export interface SupportTicketFilters {
  search: string;
}

export interface SupportRoleScope {
  role: AdminRole;
  region: string | null;
  placeOwnerId: string | null;
}

export interface SendSupportMessageRequest {
  ticketId: string;
  content: string;
  isInternal: boolean;
}

export interface AiSupportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

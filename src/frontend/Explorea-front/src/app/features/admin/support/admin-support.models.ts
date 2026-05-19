import { AdminRole } from '../core/models/admin.models';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicketPriority = 'low' | 'medium' | 'high';

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
  isEscalated: boolean;
  senderRole: string | null;
  isAssignedToMe: boolean;
}

export interface SupportTicket extends SupportConversation {
  messages: SupportMessage[];
  assignedToName: string | null;
  region: string | null;
  placeOwnerId: string | null;
}

export interface SupportTicketFilters {
  search: string;
  status?: string;
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
  isAssignedToMe?: boolean;
}

export interface AiSupportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// Ticket creation flow
export interface MyPlaceOption {
  id: string;
  name: string;
  previewImageUrl: string | null;
}

export interface CreateTicketRequest {
  title: string;
  message: string;
  linkedContextType: string | null;
  linkedContextId: string | null;
  isNonObjectRelated: boolean;
}

export type NewTicketStep = 'place-select' | 'contact-type' | 'form';

// Backend DTO shapes
export interface BackendTicketListItemDto {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerUserId: string | null;
  ownerName: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  linkedContextType: string | null;
  linkedContextId: string | null;
  isEscalated: boolean;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  senderRole: string | null;
}

export interface BackendMessageDto {
  id: string;
  ticketId: string;
  senderUserId: string;
  senderType: string;
  senderName: string | null;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface BackendTicketDetailDto extends BackendTicketListItemDto {
  createdByAdminId: string | null;
  createdByAdminName: string | null;
  escalatedAt: string | null;
  escalatedByUserId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: BackendMessageDto[];
}

export interface BackendPagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

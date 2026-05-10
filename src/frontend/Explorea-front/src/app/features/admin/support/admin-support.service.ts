import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { filterSupportTicketsByScope, MOCK_SUPPORT_TICKETS } from './admin-support.mock';
import {
  SendSupportMessageRequest,
  SupportConversation,
  SupportRoleScope,
  SupportTicket,
  SupportTicketFilters,
} from './admin-support.models';

@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  private readonly tickets = MOCK_SUPPORT_TICKETS.map((ticket) => this.cloneTicket(ticket));

  constructor(private readonly auth: DashboardAuthService) {}

  getConversations(filters: SupportTicketFilters): Observable<SupportConversation[]> {
    const search = filters.search.trim().toLowerCase();
    let visibleTickets = filterSupportTicketsByScope(this.tickets, this.currentScope());

    if (search) {
      visibleTickets = visibleTickets.filter((ticket) => this.matchesSearch(ticket, search));
    }

    const conversations = visibleTickets
      .map((ticket) => this.toConversation(ticket))
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return of(conversations).pipe(delay(180));
  }

  getTicket(ticketId: string): Observable<SupportTicket> {
    const ticket = this.findVisibleTicket(ticketId);

    if (!ticket) {
      return throwError(() => new Error('Support ticket was not found.'));
    }

    return of(this.cloneTicket(ticket)).pipe(delay(140));
  }

  sendMessage(request: SendSupportMessageRequest): Observable<SupportTicket> {
    const ticket = this.findVisibleTicket(request.ticketId);
    const content = request.content.trim();

    if (!ticket || !content) {
      return throwError(() => new Error('Support message could not be sent.'));
    }

    const createdAt = new Date().toISOString();
    ticket.messages.push({
      id: `msg-${ticket.id}-${ticket.messages.length + 1}`,
      ticketId: ticket.id,
      author: 'admin',
      authorName: this.auth.userName,
      content,
      createdAt,
      isInternal: request.isInternal,
    });
    ticket.lastMessage = content;
    ticket.lastMessageAt = createdAt;
    ticket.unreadCount = 0;

    return of(this.cloneTicket(ticket)).pipe(delay(180));
  }

  resolveTicket(ticketId: string): Observable<SupportTicket> {
    const ticket = this.findVisibleTicket(ticketId);

    if (!ticket) {
      return throwError(() => new Error('Support ticket was not found.'));
    }

    ticket.status = 'resolved';
    ticket.unreadCount = 0;

    return of(this.cloneTicket(ticket)).pipe(delay(160));
  }

  private findVisibleTicket(ticketId: string): SupportTicket | undefined {
    return filterSupportTicketsByScope(this.tickets, this.currentScope()).find(
      (ticket) => ticket.id === ticketId,
    );
  }

  private currentScope(): SupportRoleScope {
    const role = this.auth.role();

    return {
      role,
      region: role === 'tourist_organization' ? 'Sumadija' : role === 'place_owner' ? 'Beograd' : null,
      placeOwnerId: role === 'place_owner' ? 'owner-belgrade-01' : null,
    };
  }

  private matchesSearch(ticket: SupportTicket, search: string): boolean {
    return [
      ticket.ticketNumber,
      ticket.userName,
      ticket.subject,
      ticket.lastMessage,
      ticket.context?.name ?? '',
    ].some((value) => value.toLowerCase().includes(search));
  }

  private toConversation(ticket: SupportTicket): SupportConversation {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userName: ticket.userName,
      userInitials: ticket.userInitials,
      subject: ticket.subject,
      lastMessage: ticket.lastMessage,
      lastMessageAt: ticket.lastMessageAt,
      unreadCount: ticket.unreadCount,
      status: ticket.status,
      priority: ticket.priority,
      context: ticket.context ? { ...ticket.context } : null,
    };
  }

  private cloneTicket(ticket: SupportTicket): SupportTicket {
    return {
      ...ticket,
      context: ticket.context ? { ...ticket.context } : null,
      messages: ticket.messages.map((message) => ({ ...message })),
    };
  }
}

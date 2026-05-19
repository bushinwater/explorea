import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import {
  AiSupportMessage,
  BackendMessageDto,
  BackendPagedResult,
  BackendTicketDetailDto,
  BackendTicketListItemDto,
  CreateTicketRequest,
  MyPlaceOption,
  SendSupportMessageRequest,
  SupportConversation,
  SupportMessage,
  SupportMessageAuthor,
  SupportTicket,
  SupportTicketFilters,
  SupportTicketPriority,
  SupportTicketStatus,
} from './admin-support.models';

@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: DashboardAuthService,
    private readonly authService: AuthService,
  ) {}

  getConversations(filters: SupportTicketFilters): Observable<SupportConversation[]> {
    const jwtRole = this.authService.getRole();
    let params = new HttpParams().set('page', 1).set('pageSize', 50);
    if (filters.status) params = params.set('status', filters.status);

    const fetchPage = (url: string, isAssignedToMe = true) =>
      this.http.get<BackendPagedResult<BackendTicketListItemDto>>(url, { params }).pipe(
        map((r) => r.items.map((dto) => this.mapConversation(dto, isAssignedToMe))),
        catchError(() => of([] as SupportConversation[])),
      );

    let source$: Observable<SupportConversation[]>;

    if (jwtRole === 'place_owner') {
      source$ = fetchPage('/api/support/tickets/mine');
    } else if (jwtRole === 'tourist_organization') {
      // Tiketi dodeljeni TO + tiketi koje je TO sam kreirao (ka superadminu)
      source$ = forkJoin([
        fetchPage('/api/admin/support/tickets', true),
        fetchPage('/api/support/tickets/mine', false),
      ]).pipe(
        map(([assigned, created]) => {
          const merged = [...assigned, ...created];
          const unique = merged.filter((c, i) => merged.findIndex((x) => x.id === c.id) === i);
          return unique;
        }),
      );
    } else {
      source$ = fetchPage(this.resolveBaseUrl());
    }

    return source$.pipe(
      map((items) => {
        const search = filters.search.trim().toLowerCase();
        const filtered = search
          ? items.filter((c) =>
              [c.ticketNumber, c.userName, c.subject, c.lastMessage].some((v) =>
                v.toLowerCase().includes(search),
              ),
            )
          : items;
        return filtered.sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
        );
      }),
    );
  }

  getTicket(ticketId: string, isAssignedToMe = true): Observable<SupportTicket> {
    const jwtRole = this.authService.getRole();

    if (jwtRole === 'place_owner') {
      return this.http
        .get<BackendTicketDetailDto>(`/api/support/tickets/${ticketId}`)
        .pipe(map((dto) => this.mapDetail(dto)));
    }

    if (jwtRole === 'tourist_organization') {
      if (!isAssignedToMe) {
        return this.http
          .get<BackendTicketDetailDto>(`/api/support/tickets/${ticketId}`)
          .pipe(map((dto) => this.mapDetail(dto)));
      }
      return this.http
        .get<BackendTicketDetailDto>(`/api/admin/support/tickets/${ticketId}`)
        .pipe(map((dto) => this.mapDetail(dto)));
    }

    return this.http
      .get<BackendTicketDetailDto>(`/api/superadmin/support/tickets/${ticketId}`)
      .pipe(map((dto) => this.mapDetail(dto)));
  }

  sendMessage(request: SendSupportMessageRequest): Observable<SupportTicket> {
    const jwtRole = this.authService.getRole();

    if (jwtRole === 'place_owner') {
      return this.http
        .post<BackendMessageDto>(`/api/support/tickets/${request.ticketId}/messages`, {
          content: request.content,
        })
        .pipe(switchMap(() => this.getTicket(request.ticketId)));
    }

    if (jwtRole === 'tourist_organization') {
      const isAssignedToMe = request.isAssignedToMe ?? true;
      if (!isAssignedToMe) {
        return this.http
          .post<BackendMessageDto>(`/api/support/tickets/${request.ticketId}/messages`, { content: request.content })
          .pipe(switchMap(() => this.getTicket(request.ticketId, false)));
      }
      const adminBody = { content: request.content, isInternal: request.isInternal };
      return this.http
        .post<BackendMessageDto>(`/api/admin/support/tickets/${request.ticketId}/messages`, adminBody)
        .pipe(switchMap(() => this.getTicket(request.ticketId, true)));
    }

    const body = { content: request.content, isInternal: request.isInternal };
    return this.http
      .post<BackendMessageDto>(`/api/superadmin/support/tickets/${request.ticketId}/messages`, body)
      .pipe(switchMap(() => this.getTicket(request.ticketId)));
  }

  resolveTicket(ticketId: string): Observable<SupportTicket> {
    const jwtRole = this.authService.getRole();
    if (jwtRole === 'super_admin') {
      return this.http
        .patch<BackendTicketDetailDto>(`/api/superadmin/support/tickets/${ticketId}`, { status: 'resolved' })
        .pipe(map((dto) => this.mapDetail(dto)));
    }
    return this.http
      .patch<BackendTicketDetailDto>(`/api/admin/support/tickets/${ticketId}/status`, { status: 'resolved' })
      .pipe(map((dto) => this.mapDetail(dto)));
  }

  getMyPlaces(): Observable<MyPlaceOption[]> {
    return this.http.get<{ id: string; name: string; previewImageUrl: string | null }[]>(
      '/api/admin/places/my',
    ).pipe(
      map((items) => items.map((p) => ({ id: p.id, name: p.name, previewImageUrl: p.previewImageUrl }))),
    );
  }

  createTicket(req: CreateTicketRequest): Observable<SupportTicket> {
    return this.http
      .post<BackendTicketDetailDto>('/api/support/tickets', {
        title: req.title,
        message: req.message,
        linkedContextType: req.linkedContextType,
        linkedContextId: req.linkedContextId,
        isNonObjectRelated: req.isNonObjectRelated,
      })
      .pipe(map((dto) => this.mapDetail(dto)));
  }

  sendAiChat(message: string, sessionId: string, history: AiSupportMessage[]): Observable<{ reply: string }> {
    return this.http.post<{ reply: string; sessionId: string }>('/api/support/ai-chat', {
      message,
      sessionId,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    });
  }

  escalateTicket(ticketId: string): Observable<SupportTicket> {
    return this.http
      .post<BackendTicketDetailDto>(`/api/admin/support/tickets/${ticketId}/escalate`, {})
      .pipe(map((dto) => this.mapDetail(dto)));
  }

  private resolveBaseUrl(): string {
    const jwtRole = this.authService.getRole();
    return jwtRole === 'super_admin'
      ? '/api/superadmin/support/tickets'
      : '/api/admin/support/tickets';
  }

  private mapConversation(dto: BackendTicketListItemDto, isAssignedToMe = true): SupportConversation {
    return {
      id: dto.id,
      ticketNumber: '#' + dto.id.replace(/-/g, '').substring(0, 8).toUpperCase(),
      userName: dto.ownerName ?? 'Nepoznat korisnik',
      userInitials: this.getInitials(dto.ownerName),
      subject: dto.title,
      lastMessage: dto.lastMessage ?? '',
      lastMessageAt: dto.lastMessageAt ?? dto.lastActivityAt,
      unreadCount: 0,
      status: this.mapStatus(dto.status),
      priority: (dto.priority as SupportTicketPriority) ?? 'medium',
      context: null,
      isEscalated: dto.isEscalated,
      senderRole: dto.senderRole ?? null,
      isAssignedToMe,
    };
  }

  private mapDetail(dto: BackendTicketDetailDto): SupportTicket {
    return {
      ...this.mapConversation(dto),
      messages: dto.messages.map((m) => this.mapMessage(m)),
      assignedToName: dto.assignedToName ?? null,
      region: null,
      placeOwnerId: null,
    };
  }

  private mapMessage(dto: BackendMessageDto): SupportMessage {
    return {
      id: dto.id,
      ticketId: dto.ticketId,
      author: this.mapSenderType(dto.senderType),
      authorName: dto.senderName ?? '',
      content: dto.content,
      createdAt: dto.createdAt,
      isInternal: dto.isInternal,
    };
  }

  private mapStatus(status: string): SupportTicketStatus {
    const statusMap: Record<string, SupportTicketStatus> = {
      open: 'open',
      in_progress: 'in_progress',
      resolved: 'resolved',
      closed: 'closed',
    };
    return statusMap[status] ?? 'open';
  }

  private mapSenderType(senderType: string): SupportMessageAuthor {
    return senderType === 'user' ? 'user' : 'admin';
  }

  private getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() ?? '?';
  }
}

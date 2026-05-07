import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminSupportService } from './admin-support.service';
import { SupportConversation, SupportMessage, SupportTicket, SupportTicketStatus } from './admin-support.models';

@Component({
  selector: 'app-admin-support-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-support-page.component.html',
  styleUrl: './admin-support-page.component.css',
})
export class AdminSupportPageComponent implements OnInit, OnDestroy {
  private readonly searchInput$ = new Subject<string>();
  private readonly subscription = new Subscription();

  protected readonly conversations = signal<SupportConversation[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isTicketLoading = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly activeConversationId = signal<string | null>(null);
  protected readonly selectedTicket = signal<SupportTicket | null>(null);
  protected readonly selectedConversation = computed(() => {
    const activeId = this.activeConversationId();
    if (!activeId || activeId === 'ai-assistant') return null;

    return this.conversations().find((conversation) => conversation.id === activeId) ?? null;
  });

  constructor(private readonly supportService: AdminSupportService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(250), distinctUntilChanged()).subscribe((search) => {
        this.searchTerm.set(search);
        this.loadConversations();
      }),
    );

    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected selectAiAssistant(): void {
    this.activeConversationId.set('ai-assistant');
    this.selectedTicket.set(null);
    this.isTicketLoading.set(false);
  }

  protected selectConversation(conversationId: string): void {
    this.activeConversationId.set(conversationId);
    this.loadTicket(conversationId);
  }

  protected isAiAssistantActive(): boolean {
    return this.activeConversationId() === 'ai-assistant';
  }

  protected statusLabel(status: SupportTicketStatus): string {
    const labels: Record<SupportTicketStatus, string> = {
      open: 'Otvoren',
      resolved: 'Resen',
      pending: 'Na cekanju',
    };

    return labels[status];
  }

  protected relativeTime(isoDate: string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;

    return `${Math.floor(hours / 24)} d`;
  }

  protected messageTime(isoDate: string): string {
    return new Intl.DateTimeFormat('sr-Latn-RS', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  }

  protected messageClass(message: SupportMessage): string {
    if (message.isInternal) return 'support-message--internal';
    return `support-message--${message.author}`;
  }

  private loadConversations(): void {
    this.isLoading.set(true);

    this.subscription.add(
      this.supportService.getConversations({ search: this.searchTerm() }).subscribe({
        next: (conversations) => {
          this.conversations.set(conversations);
          this.isLoading.set(false);
        },
        error: () => {
          this.conversations.set([]);
          this.isLoading.set(false);
        },
      }),
    );
  }

  private loadTicket(ticketId: string): void {
    this.isTicketLoading.set(true);
    this.selectedTicket.set(null);

    this.subscription.add(
      this.supportService.getTicket(ticketId).subscribe({
        next: (ticket) => {
          this.selectedTicket.set(ticket);
          this.isTicketLoading.set(false);
        },
        error: () => {
          this.selectedTicket.set(null);
          this.isTicketLoading.set(false);
        },
      }),
    );
  }
}

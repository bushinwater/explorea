import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, interval } from 'rxjs';
import { ChatMessage, ChatService } from '../../../core/services/chat.service';
import { DashboardAuthService } from '../core/services/dashboard-auth.service';
import { AdminSupportService } from './admin-support.service';
import {
  AiSupportMessage,
  CreateTicketRequest,
  MyPlaceOption,
  NewTicketStep,
  SupportConversation,
  SupportContextType,
  SupportMessage,
  SupportTicketPriority,
  SupportTicket,
  SupportTicketStatus,
} from './admin-support.models';

type SupportMobileView = 'list' | 'chat' | 'details';

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
  protected readonly isSendingReply = signal(false);
  protected readonly isResolvingTicket = signal(false);
  protected readonly isAiSending = signal(false);
  protected readonly isEscalatingTicket = signal(false);
  protected readonly searchTerm = signal('');

  // New ticket flow
  protected readonly showNewTicketModal = signal(false);
  protected readonly newTicketStep = signal<NewTicketStep>('place-select');
  protected readonly myPlaces = signal<MyPlaceOption[]>([]);
  protected readonly isLoadingPlaces = signal(false);
  protected readonly selectedPlaceId = signal<string | null>(null);
  protected readonly newTicketTitle = signal('');
  protected readonly newTicketMessage = signal('');
  protected readonly isCreatingTicket = signal(false);
  protected readonly replyText = signal('');
  protected readonly aiInputText = signal('');
  protected readonly isInternalNote = signal(false);
  protected readonly aiMessages = signal<AiSupportMessage[]>([]);
  protected readonly aiSendError = signal('');
  protected readonly activeConversationId = signal<string | null>(null);
  protected readonly selectedTicket = signal<SupportTicket | null>(null);
  protected readonly mobileView = signal<SupportMobileView>('list');
  protected readonly internalMessages = computed(() =>
    this.selectedTicket()?.messages.filter((message) => message.isInternal) ?? [],
  );
  protected readonly selectedConversation = computed(() => {
    const activeId = this.activeConversationId();
    if (!activeId || activeId === 'ai-assistant') return null;

    return this.conversations().find((conversation) => conversation.id === activeId) ?? null;
  });

  constructor(
    private readonly supportService: AdminSupportService,
    private readonly chatService: ChatService,
    protected readonly auth: DashboardAuthService,
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.searchInput$.pipe(debounceTime(250), distinctUntilChanged()).subscribe((search) => {
        this.searchTerm.set(search);
        this.loadConversations();
      }),
    );

    this.loadConversations();

    this.subscription.add(
      interval(30_000).subscribe(() => this.loadConversations(false)),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  protected updateSearch(value: string): void {
    this.searchInput$.next(value);
  }

  protected updateReplyText(value: string): void {
    this.replyText.set(value);
  }

  protected updateAiInputText(value: string): void {
    this.aiInputText.set(value);
  }

  protected toggleInternalNote(checked: boolean): void {
    this.isInternalNote.set(checked);
  }

  protected selectAiAssistant(): void {
    this.activeConversationId.set('ai-assistant');
    this.selectedTicket.set(null);
    this.isTicketLoading.set(false);
    this.mobileView.set('chat');
  }

  protected selectConversation(conversationId: string): void {
    this.activeConversationId.set(conversationId);
    this.mobileView.set('chat');
    this.loadTicket(conversationId);
  }

  protected backToMobileList(): void {
    this.mobileView.set('list');
  }

  protected backToMobileChat(): void {
    this.mobileView.set('chat');
  }

  protected openMobileDetails(): void {
    if (this.selectedTicket()) {
      this.mobileView.set('details');
    }
  }

  protected isAiAssistantActive(): boolean {
    return this.activeConversationId() === 'ai-assistant';
  }

  protected statusLabel(status: SupportTicketStatus): string {
    const labels: Record<SupportTicketStatus, string> = {
      open: 'Otvoren',
      in_progress: 'U toku',
      resolved: 'Rešen',
      closed: 'Zatvoren',
    };

    return labels[status] ?? status;
  }

  protected priorityLabel(priority: SupportTicketPriority): string {
    const labels: Record<SupportTicketPriority, string> = {
      low: 'Nizak',
      medium: 'Srednji',
      high: 'Visok',
    };

    return labels[priority] ?? priority;
  }

  protected contextTypeLabel(type: SupportContextType): string {
    const labels: Record<SupportContextType, string> = {
      destination: 'Destinacija',
      place: 'Mesto',
      activity: 'Aktivnost',
      event: 'Dogadjaj',
    };

    return labels[type];
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

  protected aiMessageClass(message: AiSupportMessage): string {
    return message.role === 'assistant' ? 'support-message--ai' : 'support-message--admin';
  }

  protected sendReply(): void {
    const ticket = this.selectedTicket();
    const content = this.replyText().trim();
    if (!ticket || !content || this.isSendingReply()) return;

    this.isSendingReply.set(true);

    const isAssignedToMe = this.conversations().find(c => c.id === ticket.id)?.isAssignedToMe ?? true;

    this.subscription.add(
      this.supportService.sendMessage({
        ticketId: ticket.id,
        content,
        isInternal: this.isInternalNote(),
        isAssignedToMe,
      }).subscribe({
        next: (updatedTicket) => {
          this.selectedTicket.set(updatedTicket);
          this.replyText.set('');
          this.isInternalNote.set(false);
          this.isSendingReply.set(false);
          this.loadConversations(false);
        },
        error: () => {
          this.isSendingReply.set(false);
        },
      }),
    );
  }

  protected resolveTicket(): void {
    const ticket = this.selectedTicket();
    if (!ticket || ticket.status === 'resolved' || this.isResolvingTicket()) return;

    this.isResolvingTicket.set(true);

    this.subscription.add(
      this.supportService.resolveTicket(ticket.id).subscribe({
        next: (updatedTicket) => {
          this.selectedTicket.set(updatedTicket);
          this.isResolvingTicket.set(false);
          this.loadConversations(false);
        },
        error: () => {
          this.isResolvingTicket.set(false);
        },
      }),
    );
  }

  protected escalateTicket(): void {
    const ticket = this.selectedTicket();
    if (!ticket || ticket.isEscalated || this.isEscalatingTicket()) return;

    this.isEscalatingTicket.set(true);

    this.subscription.add(
      this.supportService.escalateTicket(ticket.id).subscribe({
        next: (updatedTicket) => {
          this.selectedTicket.set(updatedTicket);
          this.isEscalatingTicket.set(false);
          this.loadConversations(false);
        },
        error: () => {
          this.isEscalatingTicket.set(false);
        },
      }),
    );
  }

  protected openNewTicket(): void {
    this.showNewTicketModal.set(true);
    this.newTicketTitle.set('');
    this.newTicketMessage.set('');
    this.selectedPlaceId.set(null);

    if (this.auth.role() === 'place_owner') {
      this.newTicketStep.set('place-select');
      this.isLoadingPlaces.set(true);
      this.subscription.add(
        this.supportService.getMyPlaces().subscribe({
          next: (places) => {
            this.myPlaces.set(places);
            this.isLoadingPlaces.set(false);
            if (places.length === 0) {
              this.newTicketStep.set('contact-type');
            }
          },
          error: () => {
            this.myPlaces.set([]);
            this.isLoadingPlaces.set(false);
            this.newTicketStep.set('contact-type');
          },
        }),
      );
    } else {
      this.newTicketStep.set('form');
    }
  }

  protected closeNewTicket(): void {
    this.showNewTicketModal.set(false);
  }

  protected selectPlaceForTicket(placeId: string | null): void {
    this.selectedPlaceId.set(placeId);
    if (placeId === null) {
      this.newTicketStep.set('contact-type');
    } else {
      this.newTicketStep.set('form');
    }
  }

  protected chooseHuman(): void {
    this.newTicketStep.set('form');
  }

  protected chooseAi(): void {
    this.showNewTicketModal.set(false);
    this.selectAiAssistant();
  }

  protected submitNewTicket(): void {
    const title = this.newTicketTitle().trim();
    const message = this.newTicketMessage().trim();
    if (!title || !message || this.isCreatingTicket()) return;

    const placeId = this.selectedPlaceId();
    const isNonObjectRelated = placeId === null && this.auth.role() === 'place_owner';

    const req: CreateTicketRequest = {
      title,
      message,
      linkedContextType: placeId ? 'place' : null,
      linkedContextId: placeId,
      isNonObjectRelated,
    };

    this.isCreatingTicket.set(true);
    this.subscription.add(
      this.supportService.createTicket(req).subscribe({
        next: (ticket) => {
          this.isCreatingTicket.set(false);
          this.showNewTicketModal.set(false);
          this.loadConversations(false);
          this.selectConversation(ticket.id);
        },
        error: () => {
          this.isCreatingTicket.set(false);
        },
      }),
    );
  }

  protected sendAiMessage(): void {
    const content = this.aiInputText().trim();
    if (!content || this.isAiSending()) return;

    const userMessage: AiSupportMessage = {
      id: `ai-user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    const history: ChatMessage[] = this.aiMessages().map(({ role, content }) => ({ role, content }));

    this.aiMessages.update((messages) => [...messages, userMessage]);
    this.aiInputText.set('');
    this.aiSendError.set('');
    this.isAiSending.set(true);

    this.subscription.add(
      this.chatService.send(history, content).subscribe({
        next: (response) => {
          this.aiMessages.update((messages) => [
            ...messages,
            {
              id: `ai-assistant-${Date.now()}`,
              role: 'assistant',
              content: response.reply,
              createdAt: new Date().toISOString(),
            },
          ]);
          this.isAiSending.set(false);
        },
        error: () => {
          this.aiSendError.set('Greska pri slanju poruke AI asistentu.');
          this.isAiSending.set(false);
        },
      }),
    );
  }

  protected onReplyKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  protected onAiKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendAiMessage();
    }
  }

  private loadConversations(showLoading = true): void {
    if (showLoading) {
      this.isLoading.set(true);
    }

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
    this.isResolvingTicket.set(false);
    this.selectedTicket.set(null);

    const isAssignedToMe = this.conversations().find(c => c.id === ticketId)?.isAssignedToMe ?? true;

    this.subscription.add(
      this.supportService.getTicket(ticketId, isAssignedToMe).subscribe({
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

import { ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AiChatMessage, AiInsight, AiQuickAction } from '../../../core/models/admin.models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-panel.html',
  styleUrl: './ai-panel.css',
})
export class AiPanel implements OnDestroy {
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLElement>;

  @Input() set insights(value: AiInsight[]) {
    this.displayInsights.set(value ?? []);
  }

  displayInsights = signal<AiInsight[]>([]);
  quickActions = signal<AiQuickAction[]>([]);
  messages = signal<AiChatMessage[]>([]);
  inputText = '';
  isTyping = signal(false);
  errorMessage = signal<string | null>(null);

  private chatSubscription?: Subscription;

  constructor(
    public ui: AdminUiPreferencesService,
    private dashboardService: DashboardService,
    private router: Router,
  ) {}

  ngOnDestroy(): void {
    this.chatSubscription?.unsubscribe();
  }

  insightIconColor(type: AiInsight['type']): string {
    return { positive: 'var(--color-success)', warning: 'var(--color-warning)', neutral: 'var(--color-info)' }[type];
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text || this.isTyping()) return;

    this.messages.update(m => [...m, { role: 'user', text }]);
    this.inputText = '';
    this.isTyping.set(true);
    this.errorMessage.set(null);
    this.scrollMessagesToBottom();

    const history = this.messages().slice(-8);
    this.chatSubscription?.unsubscribe();
    this.chatSubscription = this.dashboardService.sendAiMessage(text, history).subscribe({
      next: (response) => {
        this.messages.update(m => [...m, { role: 'ai', text: response.message }]);
        if (response.insights.length > 0) {
          this.displayInsights.set(response.insights);
        }
        this.quickActions.set(response.quickActions);
        this.isTyping.set(false);
        this.scrollMessagesToBottom();
      },
      error: () => {
        this.errorMessage.set('AI asistent trenutno nije dostupan.');
        this.isTyping.set(false);
        this.scrollMessagesToBottom();
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  runQuickAction(action: AiQuickAction): void {
    void this.router.navigateByUrl(action.route);
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const el = this.messagesViewport?.nativeElement;
      if (!el) return;

      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }
}

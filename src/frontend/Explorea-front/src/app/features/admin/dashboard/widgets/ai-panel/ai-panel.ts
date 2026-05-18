import { ChangeDetectionStrategy, Component, Input, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiChatMessage, AiInsight } from '../../../core/models/admin.models';
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
  @Input() set insights(value: AiInsight[]) {
    this.displayInsights.set(value ?? []);
  }

  displayInsights = signal<AiInsight[]>([]);
  messages = signal<AiChatMessage[]>([]);
  inputText = '';
  isTyping = signal(false);
  errorMessage = signal<string | null>(null);

  private chatSubscription?: Subscription;

  constructor(
    public ui: AdminUiPreferencesService,
    private dashboardService: DashboardService,
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

    const history = this.messages().slice(-8);
    this.chatSubscription?.unsubscribe();
    this.chatSubscription = this.dashboardService.sendAiMessage(text, history).subscribe({
      next: (response) => {
        this.messages.update(m => [...m, { role: 'ai', text: response.message }]);
        if (response.insights.length > 0) {
          this.displayInsights.set(response.insights);
        }
        this.isTyping.set(false);
      },
      error: () => {
        this.errorMessage.set('AI asistent trenutno nije dostupan.');
        this.isTyping.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}

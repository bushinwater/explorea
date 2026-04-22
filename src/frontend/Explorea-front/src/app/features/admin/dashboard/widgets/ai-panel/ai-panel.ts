import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiInsight } from '../../../core/models/admin.models';
import { AdminUiPreferencesService } from '../../../core/services/admin-ui-preferences.service';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

const AI_RESPONSES: string[] = [
  'Na osnovu podataka, preporučujem fokus na vikend posete — tu je 35% veći promet.',
  'Vidim 3 mesta sa ocenom ispod 3.5 ovog meseca. Preporučujem kontakt sa vlasnicima.',
  'Rezervacije rastu 12% mesečno. Ako trend nastavi, premašićete cilj za Q3.',
  'Korisnici iz Vojvodine imaju najmanji engagement. Razmotriti lokalizovani sadržaj.',
  'Top 3 pretraživane destinacije ove nedelje: Golubac, Đavolja Varoš, Tara.',
];

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-panel.html',
  styleUrl: './ai-panel.css',
})
export class AiPanel {
  @Input() insights: AiInsight[] = [];

  messages = signal<ChatMessage[]>([]);
  inputText = '';
  isTyping = signal(false);

  constructor(public ui: AdminUiPreferencesService) {}

  insightIconColor(type: AiInsight['type']): string {
    return { positive: 'var(--color-success)', warning: 'var(--color-warning)', neutral: 'var(--color-info)' }[type];
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text) return;

    this.messages.update(m => [...m, { role: 'user', text }]);
    this.inputText = '';
    this.isTyping.set(true);

    setTimeout(() => {
      const response = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
      this.messages.update(m => [...m, { role: 'ai', text: response }]);
      this.isTyping.set(false);
    }, 900 + Math.random() * 600);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}

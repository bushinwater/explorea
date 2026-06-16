import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessage, ChatContext, ChatReference } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { ChatBubbleService } from '../../../core/services/chat-bubble.service';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './chat-bubble.html',
  styleUrl: './chat-bubble.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ChatBubble implements OnInit, OnDestroy {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLTextAreaElement>;

  private static readonly STORAGE_KEY = 'explorea_chat_history';
  private static readonly MAX_MESSAGES = 50;

  open = false;
  input = '';
  loading = false;
  sendError = '';
  messages: ChatMessage[] = [];

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private locationService = inject(LocationService);
  private chatBubbleService = inject(ChatBubbleService);
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  sendSuggestion(key: string): void {
    this.input = this.translate.instant(key);
    this.send();
  }

  private sub = new Subscription();
  private wasLoggedIn = false;

  get firstName(): string { return this.authService.getFirstName(); }
  get isLoggedIn(): boolean { return this.authService.isLoggedIn(); }

  ngOnInit(): void {
    this.wasLoggedIn = this.isLoggedIn;

    if (this.isLoggedIn) {
      this.chatService.getHistory().subscribe({
        next: (res) => {
          this.messages = res.messages;
          // Wipe any leftover guest-session blob the moment we know the DB
          // is the source of truth — otherwise the user sees stale messages
          // from a prior guest session in DevTools and (worse) the error
          // branch below could resurrect them on the next transient failure.
          this.clearLocalHistory();
          this.cdr.detectChanges();
        },
        error: () => {
          // Don't fall back to localStorage for an authenticated user — that
          // could expose another user's guest history if multiple people
          // share the browser. Start empty and let the user retry.
          this.messages = [];
          this.cdr.detectChanges();
        },
      });
    } else {
      this.messages = this.loadLocalHistory();
    }

    this.sub.add(
      this.chatBubbleService.trigger$.subscribe((message) => {
        this.open = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.input = message;
          this.send();
        }, 80);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) setTimeout(() => this.inputEl?.nativeElement.focus(), 50);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.open = false;
  }

  formatMessage(content: string): SafeHtml {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const withLinks = escaped.replace(
      /\[([^\]]+)\]\((\/[^\)]+)\)/g,
      '<a class="chat-link" href="$2">$1</a>'
    );

    const withBreaks = withLinks.replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(withBreaks);
  }

  navigateLink(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a.chat-link') as HTMLAnchorElement | null;
    if (!anchor) return;
    event.preventDefault();
    this.router.navigateByUrl(anchor.getAttribute('href') ?? '/');
    this.open = false;
  }

  openReference(ref: ChatReference): void {
    const pathByType: Record<ChatReference['type'], string> = {
      destination: 'destinations',
      place:       'places',
      activity:    'activities',
      event:       'events',
    };
    const segment = pathByType[ref.type];
    if (!segment) return;
    this.router.navigateByUrl(`/${segment}/${ref.slug}`);
    this.open = false;
  }

  referenceTypeLabel(type: ChatReference['type']): string {
    const map: Record<ChatReference['type'], string> = {
      destination: 'CHAT.REF_TYPE.DESTINATION',
      place:       'CHAT.REF_TYPE.PLACE',
      activity:    'CHAT.REF_TYPE.ACTIVITY',
      event:       'CHAT.REF_TYPE.EVENT',
    };
    return this.translate.instant(map[type]);
  }

  referenceFallbackIcon(type: ChatReference['type']): string {
    const map: Record<ChatReference['type'], string> = {
      destination: 'landscape',
      place:       'store',
      activity:    'directions_walk',
      event:       'event',
    };
    return map[type];
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.loading) return;

    // User just logged in mid-session — migrate history then send
    if (this.isLoggedIn && !this.wasLoggedIn) {
      this.wasLoggedIn = true;
      this.loading = true;
      this.cdr.detectChanges();

      this.chatService.getHistory().subscribe({
        next: (res) => {
          if (res.messages.length > 0) {
            // Account already has history → use it
            this.messages = res.messages;
          } else if (this.messages.length > 0) {
            // Account is empty → migrate local history to server
            this.chatService.saveHistory(this.messages).subscribe();
          }
          this.clearLocalHistory();
          this.loading = false;
          this.cdr.detectChanges();
          this.dispatchMessage(text);
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
          this.dispatchMessage(text);
        },
      });
      return;
    }

    this.dispatchMessage(text);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private dispatchMessage(text: string): void {
    this.sendError = '';
    this.messages.push({ role: 'user', content: text });
    this.input = '';
    this.loading = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    const history = this.messages.slice(0, -1);
    const location = this.locationService.getCached();
    const context: ChatContext = {};
    if (location) { context.lat = location.lat; context.lng = location.lng; }
    if (this.isLoggedIn) context.firstName = this.firstName;

    this.chatService.send(history, text, context).subscribe({
      next: (res) => {
        this.messages.push({
          role: 'assistant',
          content: res.reply,
          references: res.references ?? [],
        });
        this.persistHistory();
        this.loading = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: () => {
        this.loading = false;
        this.sendError = 'Greška pri slanju. Pokušajte ponovo.';
        this.cdr.detectChanges();
      },
    });
  }

  private persistHistory(): void {
    const trimmed = this.messages.slice(-ChatBubble.MAX_MESSAGES);
    this.messages = trimmed;
    if (this.isLoggedIn) {
      this.chatService.saveHistory(trimmed).subscribe();
    } else {
      this.saveLocalHistory(trimmed);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  private loadLocalHistory(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(ChatBubble.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    } catch { return []; }
  }

  private saveLocalHistory(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(ChatBubble.STORAGE_KEY, JSON.stringify(messages));
    } catch { /* storage unavailable */ }
  }

  private clearLocalHistory(): void {
    try {
      localStorage.removeItem(ChatBubble.STORAGE_KEY);
    } catch { /* storage unavailable */ }
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  lat?: number;
  lng?: number;
  firstName?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  send(history: ChatMessage[], message: string, context?: ChatContext): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>('/api/chat', { history, message, context });
  }
}

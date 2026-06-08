import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ChatReference {
  type: 'destination' | 'place' | 'activity' | 'event';
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  references?: ChatReference[];
}

export interface ChatContext {
  lat?: number;
  lng?: number;
  firstName?: string;
}

export interface ChatReply {
  reply: string;
  references?: ChatReference[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  send(history: ChatMessage[], message: string, context?: ChatContext): Observable<ChatReply> {
    return this.http.post<ChatReply>('/api/chat', { history, message, context });
  }

  getHistory(): Observable<{ messages: ChatMessage[] }> {
    return this.http.get<{ messages: ChatMessage[] }>('/api/chat/history');
  }

  saveHistory(messages: ChatMessage[]): Observable<void> {
    return this.http.put<void>('/api/chat/history', { messages });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type BroadcastRecipient =
  | 'all_users'
  | 'super_admins'
  | 'tourist_organizations'
  | 'place_owners';

export interface BroadcastNotificationRequest {
  title: string;
  message: string;
  recipient: BroadcastRecipient;
  linkUrl: string | null;
}

export interface BroadcastNotificationResponse {
  sentCount: number;
}

export interface AdminNotificationInbox {
  unreadCount: number;
  items: AdminNotificationItem[];
}

export interface AdminNotificationItem {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminBroadcastNotificationService {
  private readonly api = '/api/admin/notifications';

  constructor(private readonly http: HttpClient) {}

  send(request: BroadcastNotificationRequest): Observable<BroadcastNotificationResponse> {
    return this.http.post<BroadcastNotificationResponse>(`${this.api}/broadcast`, request);
  }

  getInbox(take = 10): Observable<AdminNotificationInbox> {
    return this.http.get<AdminNotificationInbox>(this.api, {
      params: { take },
    });
  }

  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/${id}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.api}/read-all`, {});
  }
}

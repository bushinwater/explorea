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

@Injectable({ providedIn: 'root' })
export class AdminBroadcastNotificationService {
  private readonly api = '/api/admin/notifications/broadcast';

  constructor(private readonly http: HttpClient) {}

  send(request: BroadcastNotificationRequest): Observable<BroadcastNotificationResponse> {
    return this.http.post<BroadcastNotificationResponse>(this.api, request);
  }
}

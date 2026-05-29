import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import {
  DeleteReviewRequest,
  ReviewFilters,
  ReviewPagedResponse,
  ReviewStats,
} from './admin-reviews.models';

@Injectable({ providedIn: 'root' })
export class AdminReviewsService {
  private readonly api = '/api/admin/reviews';

  constructor(private readonly http: HttpClient) {}

  getReviews(filters: ReviewFilters): Observable<ReviewPagedResponse> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.entityType !== 'all') {
      params = params.set('entityType', filters.entityType);
    }
    if (filters.subtypeId !== null) {
      params = params.set('subtypeId', filters.subtypeId);
    }
    if (filters.regionId !== null) {
      params = params.set('regionId', filters.regionId);
    }
    if (filters.cityId !== null) {
      params = params.set('cityId', filters.cityId);
    }
    if (filters.minRating !== null) {
      params = params.set('minRating', filters.minRating);
    }
    if (filters.maxRating !== null) {
      params = params.set('maxRating', filters.maxRating);
    }
    if (filters.visibility === 'visible') {
      params = params.set('isHidden', 'false');
    } else if (filters.visibility === 'hidden') {
      params = params.set('isHidden', 'true');
    }
    if (filters.search) {
      params = params.set('search', filters.search);
    }
    for (const ef of filters.extraFilters) {
      params = params.append('extraFilters', ef);
    }

    return this.http.get<ReviewPagedResponse>(this.api, { params });
  }

  getStats(): Observable<ReviewStats> {
    const minimal = new HttpParams().set('page', 1).set('pageSize', 1);
    const forRating = new HttpParams().set('page', 1).set('pageSize', 50);

    return forkJoin({
      all: this.http.get<ReviewPagedResponse>(this.api, { params: minimal }),
      hidden: this.http.get<ReviewPagedResponse>(this.api, {
        params: minimal.set('isHidden', 'true'),
      }),
      sample: this.http.get<ReviewPagedResponse>(this.api, { params: forRating }),
    }).pipe(
      map(({ all, hidden, sample }) => ({
        total: all.total,
        hiddenCount: hidden.total,
        avgRating:
          sample.items.length
            ? Math.round(
                (sample.items.reduce((s, r) => s + r.rating, 0) / sample.items.length) * 10,
              ) / 10
            : 0,
      })),
    );
  }

  hide(id: string): Observable<void> {
    return this.http.put<void>(`${this.api}/${id}/hide`, {});
  }

  approve(id: string): Observable<void> {
    return this.http.put<void>(`${this.api}/${id}/approve`, {});
  }

  delete(id: string, reason?: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`, {
      body: { reason } as DeleteReviewRequest,
    });
  }

  reply(id: string, replyText: string): Observable<{ ownerReply: string; ownerReplyAt: string }> {
    return this.http.post<{ ownerReply: string; ownerReplyAt: string }>(
      `/api/reviews/${id}/reply`,
      { reply: replyText },
    );
  }
}

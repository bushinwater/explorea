import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewDto } from '../models/home.model';

export interface CreateReviewRequest {
  entityType: string;
  entityId: string;
  rating: number;
  comment?: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly api = '/api/reviews';

  constructor(private http: HttpClient) {}

  check(entityType: string, entityId: string): Observable<{ hasReviewed: boolean }> {
    return this.http.get<{ hasReviewed: boolean }>(`${this.api}/check`, {
      params: { entityType, entityId }
    });
  }

  create(dto: CreateReviewRequest): Observable<ReviewDto> {
    return this.http.post<ReviewDto>(this.api, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}

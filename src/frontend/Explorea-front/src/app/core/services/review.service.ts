import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewDto } from '../models/home.model';

export interface CreateReviewRequest {
  entityType: string;
  entityId: string;
  rating: number;
  comment?: string;
  imageUrls?: string[];
}

export interface UpdateReviewRequest {
  rating: number;
  comment?: string;
  imageUrls?: string[];
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

  update(id: string, dto: UpdateReviewRequest): Observable<ReviewDto> {
    return this.http.put<ReviewDto>(`${this.api}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  uploadImages(files: File[]): Observable<{ urls: string[] }> {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    return this.http.post<{ urls: string[] }>(`${this.api}/images`, form);
  }
}

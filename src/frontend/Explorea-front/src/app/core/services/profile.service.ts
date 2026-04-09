import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ForYouItemDto,
  ProfileReviewDto,
  ProfileStatsDto,
  SavedItemDto,
  UpdateUserDto,
  UserProfile,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private api = '/api/profile';

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.api);
  }

  updateProfile(dto: UpdateUserDto): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.api, dto);
  }

  getForYou(): Observable<ForYouItemDto[]> {
    return this.http.get<ForYouItemDto[]>(`${this.api}/for-you`);
  }

  getSavedItems(): Observable<SavedItemDto[]> {
    return this.http.get<SavedItemDto[]>(`${this.api}/saved`);
  }

  getMyReviews(): Observable<ProfileReviewDto[]> {
    return this.http.get<ProfileReviewDto[]>(`${this.api}/reviews`);
  }

  getStats(): Observable<ProfileStatsDto> {
    return this.http.get<ProfileStatsDto>(`${this.api}/stats`);
  }

  removeAvatar(): Observable<void> {
    return this.http.delete<void>(`${this.api}/avatar`);
  }
}

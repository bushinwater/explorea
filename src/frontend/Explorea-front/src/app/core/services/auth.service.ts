import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResponseDto,
  CompleteProfileDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenRequestDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SocialCompleteDto,
  SocialLoginDto,
  VerifyEmailDto,
} from '../models/auth.model';
import { AvatarService } from './avatar.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '/api/auth';

  constructor(private http: HttpClient, private avatarService: AvatarService) {}

  login(dto: LoginDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.api}/login`, dto);
  }

  register(dto: RegisterDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/register`, dto);
  }

  refresh(dto: RefreshTokenRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.api}/refresh`, dto);
  }

  logout(dto: RefreshTokenRequestDto): Observable<void> {
    return this.http.post<void>(`${this.api}/logout`, dto);
  }

  verifyEmail(dto: VerifyEmailDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.api}/verify-email`, dto);
  }

  resendVerification(dto: ResendVerificationDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/resend-verification`, dto);
  }

  checkEmail(email: string): Observable<{ exists: boolean }> {
    return this.http.get<{ exists: boolean }>(`${this.api}/check-email`, { params: { email } });
  }

  forgotPassword(dto: ForgotPasswordDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/forgot-password`, dto);
  }

  resetPassword(dto: ResetPasswordDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/reset-password`, dto);
  }

  socialLogin(dto: SocialLoginDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.api}/social`, dto);
  }

  completeSocial(dto: SocialCompleteDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.api}/social/complete`, dto);
  }

  completeProfile(dto: CompleteProfileDto): Observable<void> {
    return this.http.patch<void>('/api/profile/complete', dto);
  }

  saveTokens(response: AuthResponseDto): void {
    if (response.accessToken)  localStorage.setItem('accessToken',  response.accessToken);
    if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
    // Read avatar from the freshly issued JWT (most reliable source — always in sync with DB)
    const avatarFromToken = this.getAvatarUrl();
    if (avatarFromToken) {
      this.avatarService.setUrl(avatarFromToken);
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Per-user chat history lives in the DB once you're logged in; on logout
    // we also wipe the local guest-mode cache so the next person sharing
    // the browser (or a fresh login with this account) doesn't see the
    // previous session's blob as a stale ChatBubble starter.
    localStorage.removeItem('explorea_chat_history');
  }

  isLoggedIn(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getCurrentUserId(): string {
    const token = this.getAccessToken();
    if (!token) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['sub']
          ?? payload['nameid']
          ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
          ?? '';
    } catch {
      return '';
    }
  }

  getRole(): string {
    const token = this.getAccessToken();
    if (!token) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['role'] ?? '';
    } catch {
      return '';
    }
  }

  getFirstName(): string {
    const token = this.getAccessToken();
    if (!token) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['firstName'] ?? '';
    } catch {
      return '';
    }
  }

  getAvatarUrl(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload['avatarUrl'] || null;
    } catch {
      return null;
    }
  }
}

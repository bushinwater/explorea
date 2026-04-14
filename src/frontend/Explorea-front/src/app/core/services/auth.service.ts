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
  SocialLoginDto,
  VerifyEmailDto,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '/api/auth';

  constructor(private http: HttpClient) {}

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

  completeProfile(dto: CompleteProfileDto): Observable<void> {
    return this.http.patch<void>('/api/profile/complete', dto);
  }

  saveTokens(response: AuthResponseDto): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
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
}

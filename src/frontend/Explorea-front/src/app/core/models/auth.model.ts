export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  needsInterests: boolean;
  needsProfileCompletion: boolean;
}

export interface CompleteProfileDto {
  gender: string;
  dateOfBirth: string;
}

export interface SocialLoginDto {
  provider: 'google' | 'facebook';
  token?: string;       // Google: access token
  code?: string;        // Facebook: authorization code
  redirectUri?: string; // Facebook: must match what was sent to the dialog
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

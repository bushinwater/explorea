export interface UserPreferences {
  theme: string;
  language: string;
  notificationsEnabled: boolean;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  travelerRank: string;
  totalVisits: number;
  memberSince: string;
  preferences?: UserPreferences;
}

export interface UpdateUserDto {
  firstName: string;
  lastName: string;
}

export interface UpdatePreferencesDto {
  theme: string;
  language: string;
  notificationsEnabled: boolean;
}

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
  profileImageUrl?: string;
  gender?: string;
  dateOfBirth?: string;
  preferences?: UserPreferences;
  newsletter: boolean;
}

export interface UpdateUserDto {
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface UpdatePreferencesDto {
  theme: string;
  language: string;
  notificationsEnabled: boolean;
}

export interface ProfileStatsDto {
  reviewsCount: number;
  savedItemsCount: number;
  memberSince: string;
}

export interface ForYouItemDto {
  id: string;
  entityType: 'destination' | 'place' | 'event' | 'activity';
  name: string;
  slug: string;
  previewImageUrl?: string;
  subtitle?: string;
  avgRating: number;
  matchedTagsCount: number;
}

export interface SavedItemDto {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  slug: string;
  previewImageUrl?: string;
  subtitle?: string;
  savedAt: string;
}

export interface ProfileReviewDto {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  entitySlug?: string;
  previewImageUrl?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

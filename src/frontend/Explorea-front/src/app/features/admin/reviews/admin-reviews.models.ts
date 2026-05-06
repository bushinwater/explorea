export type EntityType = 'destination' | 'activity' | 'place' | 'event';
export type ReviewVisibility = 'all' | 'visible' | 'hidden';

export interface ReviewRow {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  userFullName: string;
  userGender: string | null;
  userAge: number | null;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
}

export interface ReviewStats {
  total: number;
  hiddenCount: number;
  avgRating: number;
}

export interface ReviewFilters {
  entityType: EntityType | 'all';
  minRating: number | null;
  maxRating: number | null;
  visibility: ReviewVisibility;
  page: number;
  pageSize: number;
}

export interface ReviewPagedResponse {
  items: ReviewRow[];
  total: number;
}

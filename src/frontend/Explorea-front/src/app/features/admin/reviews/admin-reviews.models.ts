export type EntityType = 'destination' | 'activity' | 'place' | 'event';
export type ReviewVisibility = 'all' | 'visible' | 'hidden';

export interface ReviewRow {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityName: string | null;
  entitySlug: string | null;
  userId: string;
  userFullName: string;
  userGender: string | null;
  userAge: number | null;
  userProfileImageUrl: string | null;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  ownerReply: string | null;
  ownerReplyAt: string | null;
}

export interface ReviewStats {
  total: number;
  hiddenCount: number;
  avgRating: number;
}

export interface ReviewFilters {
  entityType: EntityType | 'all';
  subtypeId: number | null;
  regionId: number | null;
  cityId: number | null;
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

export interface DeleteReviewRequest {
  reason?: string;
}

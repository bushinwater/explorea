export interface SearchItemEntity {
  id: string;
  name: string;
  slug: string;
  previewImageUrl?: string;
  avgRating?: number;
  address?: string;
  city?: { id: number; name: string; regionId?: number };
  typeId?: number;
  type?: { id: number; name: string };
  category?: { id: number; name: string };
  startDatetime?: string;
  endDatetime?: string;
  price?: number | null;
  difficultyLevel?: string;
  durationMinutes?: number;
  location?: { lat: number; lng: number };
  latitude?: number;
  longitude?: number;
  popularity?: number;
  distanceKm?: number;
}

export interface SearchItem {
  entityType: 'destination' | 'place' | 'event' | 'activity';
  entity: SearchItemEntity;
}

export interface SearchResult {
  total: number;
  results: SearchItem[];
}

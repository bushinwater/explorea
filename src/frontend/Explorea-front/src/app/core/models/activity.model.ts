export interface ActivityCard {
  id: string;
  name: string;
  slug: string;
  category: { id: number; name: string } | null;
  avgRating: number;
  durationMinutes: number | null;
  price: number | null;
  difficultyLevel: string | null;
  previewImageUrl: string | null;
  popularity: number;
  country: { id: number; name: string } | null;
  startPoint?: string | null;
}

export interface ActivityDetail extends ActivityCard {
  organizerWebsite: string | null;
  description: string | null;
  season: { id: number; name: string } | null;
  distanceKm: number | null;
  extraData: Record<string, unknown> | null;
  location: { lat: number; lng: number } | null;
  inclusions: { id: string; item: string }[];
  images: { imageUrl: string; sortOrder: number }[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string; travelerRank: string; profileImageUrl?: string | null };
  }[];
  similarActivities: ActivityCard[];
}

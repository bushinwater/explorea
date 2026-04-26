export interface PlaceCard {
  id: string;
  name: string;
  slug: string;
  type: { id: number; name: string } | null;
  avgRating: number;
  address: string | null;
  distanceKm: number | null;
  previewImageUrl: string | null;
  isOpen: boolean;
  priceRange: string | null;
  pricePerNight: number | null;
  popularity: number;
  country: { id: number; name: string; code: string } | null;
  city: { id: number; name: string } | null;
}

export interface PlaceDetail extends PlaceCard {
  description: string | null;
  phone: string | null;
  websiteUrl: string | null;
  location: { lat: number; lng: number } | null;
  images: { imageUrl: string; caption: string | null; sortOrder: number }[];
  amenities: { id: number; name: string; icon: string }[];
  workingDays: {
    dayOfWeek: number;
    isClosed: boolean;
    intervals: { opensAt: string; closesAt: string }[];
  }[];
  events: unknown[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string; travelerRank: string; profileImageUrl?: string | null };
  }[];
  similarPlaces: PlaceCard[];
  totalReviews: number;
  viewsLast24h: number;
  hostName: string | null;
  hostAvatarUrl: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: { label: string; value: string }[];
  whatOffers: string[];
  openingHours: string | null;
  destination: { name: string; slug: string } | null;
  extraFilters: Record<string, string | boolean | number> | null;
}

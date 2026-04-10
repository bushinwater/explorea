export interface CityRef {
  id: number;
  name: string;
}

export interface CountryRef {
  id: number;
  name: string;
  code: string;
}

export interface LocationModel {
  lat: number;
  lng: number;
}

export interface DestinationImage {
  imageUrl: string;
  sortOrder: number;
}

export interface DestinationCard {
  id: string;
  name: string;
  slug: string;
  previewImageUrl?: string | null;
  heroImageUrl?: string | null;
  avgRating: number;
  isFeatured: boolean;
  popularity: number;
  city?: CityRef | null;
  country?: CountryRef | null;
  location?: LocationModel | null;
}

export interface ReviewUser {
  id: string;
  firstName: string;
  lastName: string;
  travelerRank: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: ReviewUser;
}

export interface PlaceCard {
  id: string;
  name: string;
  slug: string;
  avgRating: number;
  address?: string | null;
  distanceKm?: number | null;
  previewImageUrl?: string | null;
  isOpen: boolean;
  priceRange?: string | null;
  popularity: number;
  country?: CountryRef | null;
}

export interface EventCard {
  id: string;
  name: string;
  slug: string;
  startDatetime: string;
  endDatetime: string;
  price?: number | null;
  address?: string | null;
  city?: CityRef | null;
  previewImageUrl?: string | null;
  isFeatured: boolean;
  popularity: number;
  country?: CountryRef | null;
}

export interface ActivityCategoryRef {
  id: number;
  name: string;
}

export interface ActivityCard {
  id: string;
  name: string;
  slug: string;
  category?: ActivityCategoryRef | null;
  avgRating: number;
  durationMinutes?: number | null;
  price?: number | null;
  difficultyLevel?: string | null;
  previewImageUrl?: string | null;
  popularity: number;
  country?: CountryRef | null;
}

export interface DestinationDetail extends DestinationCard {
  description?: string | null;
  images: DestinationImage[];
  places: PlaceCard[];
  events: EventCard[];
  activities: ActivityCard[];
  reviews: Review[];
  similarDestinations: DestinationCard[];
}
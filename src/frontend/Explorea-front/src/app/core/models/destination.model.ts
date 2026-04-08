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

export interface SimpleLinkedItem {
  id: string;
  name: string;
}

export interface DestinationDetail extends DestinationCard {
  description?: string | null;
  images: DestinationImage[];
  places: SimpleLinkedItem[];
  events: SimpleLinkedItem[];
  activities: SimpleLinkedItem[];
  reviews: Review[];
  similarDestinations: DestinationCard[];
}
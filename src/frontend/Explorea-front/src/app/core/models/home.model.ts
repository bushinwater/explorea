export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: string;
  linkSlug: string;
}

export interface City {
  id: number;
  name: string;
}

export interface DestinationCard {
  id: string;
  name: string;
  slug: string;
  previewImageUrl: string;
  avgRating: number;
  city: City | null;
  location: { lat: number; lng: number };
  address?: string | null;
  isFeatured?: boolean;
}

export interface EventCard {
  id: string;
  name: string;
  slug: string;
  type: { id: number; name: string } | null;
  startDatetime: string;
  endDatetime: string;
  price: number | null;
  address: string;
  city: City | null;
  previewImageUrl: string;
  isFeatured: boolean;
  popularity?: number;
  latitude?: number;
  longitude?: number;
}

export interface ActivityCard {
  id: string;
  name: string;
  slug: string;
  category: { id: number; name: string } | null;
  avgRating: number;
  durationMinutes: number;
  price: number | null;
  difficultyLevel: string | null;
  previewImageUrl: string;
}

export interface ReviewImageDto {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  entityType?: string;
  entityName?: string;
  entitySlug?: string;
  ownerReply?: string | null;
  ownerReplyAt?: string | null;
  images?: ReviewImageDto[];
  user: {
    id: string;
    firstName: string;
    lastName: string;
    travelerRank: string;
    profileImageUrl?: string | null;
  };
}

export interface CityFilter {
  id: number | null;
  name: string;
}

export interface HomeData {
  heroBanners: HeroBanner[];
  featuredDestinations: DestinationCard[];
  upcomingEvents: EventCard[];
  popularActivities: ActivityCard[];
  travelerReviews: ReviewDto[];
}

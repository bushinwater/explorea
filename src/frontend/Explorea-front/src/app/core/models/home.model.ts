export interface HeroBanner {
  id: number;
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
  id: number;
  name: string;
  slug: string;
  previewImageUrl: string;
  avgRating: number;
  city: City;
  location: { lat: number; lng: number };
  isFeatured?: boolean;
}

export interface EventCard {
  id: number;
  name: string;
  slug: string;
  type: { id: number; name: string };
  startDatetime: string;
  endDatetime: string;
  price: number | null;
  address: string;
  city: City;
  previewImageUrl: string;
  isFeatured: boolean;
}

export interface ActivityCard {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string };
  avgRating: number;
  durationMinutes: number;
  price: number | null;
  difficultyLevel: string;
  previewImageUrl: string;
}

export interface ReviewDto {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    travelerRank: string;
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

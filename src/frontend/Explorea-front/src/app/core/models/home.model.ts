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
  city: City;
  location: { lat: number; lng: number };
  isFeatured?: boolean;
}

export interface EventCard {
  id: string;
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
  id: string;
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
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    id: string;
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

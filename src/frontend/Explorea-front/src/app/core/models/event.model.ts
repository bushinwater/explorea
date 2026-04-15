import { EventCard } from './home.model';

export type { EventCard };

export interface EventImage {
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
}

export interface EventVenueItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  slug: string;
}

export interface EventDetail extends EventCard {
  description: string | null;
  ticketUrl: string | null;
  location: { lat: number; lng: number } | null;
  images: EventImage[];
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    authorName: string;
    authorAvatarUrl: string | null;
    createdAt: string;
  }[];
  similarEvents: EventCard[];
  venueItems: EventVenueItem[];
}

export interface EventFilterParams {
  cityId?: number | null;
  typeId?: number | null;
  free?: boolean | null;
}

export interface EventListResponse {
  items: EventCard[];
  total: number;
}

export interface CalendarDay {
  date: string;
  count: number;
  events: EventCard[];
}

export interface EventType {
  id: number;
  name: string;
}

export interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
  count: number;
}

import { EventCard } from './home.model';

export type { EventCard };

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

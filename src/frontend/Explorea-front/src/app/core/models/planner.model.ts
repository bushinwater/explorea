export interface PlannerDot {
  date:  string;
  count: number;
}

export interface PlannerEntry {
  id:            string;
  eventId:       string;
  eventName:     string;
  eventSlug:     string;
  plannedAt:     string;
  note:          string | null;
  startDatetime: string | null;
  endDatetime:   string | null;
}

export interface PlannerEventRef {
  id:            string;
  name:          string;
  startDatetime: string;
  endDatetime:   string;
}

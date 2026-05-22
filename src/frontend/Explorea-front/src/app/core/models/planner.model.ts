export interface PlannerDot {
  date:  string;
  count: number;
}

export interface PlannerEntry {
  id:              string;
  entityType:      string;
  entityId:        string;
  entityName:      string;
  entitySlug:      string;
  plannedAt:       string;
  note:            string | null;
  previewImageUrl: string | null;
}

export interface PlannerEventRef {
  id:            string;
  name:          string;
  startDatetime: string;
  endDatetime:   string;
}

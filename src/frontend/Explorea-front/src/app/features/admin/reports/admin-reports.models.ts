export interface AdminGlobalSearchResult {
  entityType: 'destination' | 'activity' | 'event' | 'place';
  id:         string;
  name:       string;
}

export type ReportEntity      = 'destinations' | 'activities' | 'events' | 'places' | 'reviews' | 'users';
export type ReportDimensionId = 'region' | 'category' | 'type' | 'destination' | 'rating' | 'entityType' | 'time' | 'gender' | 'ageGroup';
export type ReportMetricId    = 'count' | 'traffic' | 'avgRating';
export type FlatTableEntity   = 'destinations' | 'activities' | 'events' | 'places';
export type VizType           = 'bar' | 'line' | 'pie' | 'table';
export type DimensionType     = 'categorical' | 'time';
export type DestTableSortBy   = 'name' | 'region' | 'type' | 'rating' | 'popularity';
export type QueueItemType     = 'chart' | 'table' | 'dest-table' | 'entity-table';

export interface ReportDimension {
  id:    ReportDimensionId;
  label: string;
  type:  DimensionType;
}

export interface ReportMetric {
  id:    ReportMetricId;
  label: string;
}

export interface EntityConfig {
  id:         ReportEntity;
  label:      string;
  dimensions: ReportDimensionId[];
  metrics:    ReportMetricId[];
}

export const DIMENSION_CONFIGS: Record<ReportDimensionId, ReportDimension> = {
  region:      { id: 'region',      label: 'Regija',         type: 'categorical' },
  category:    { id: 'category',    label: 'Kategorija',     type: 'categorical' },
  type:        { id: 'type',        label: 'Tip',            type: 'categorical' },
  destination: { id: 'destination', label: 'Destinacija',    type: 'categorical' },
  rating:      { id: 'rating',      label: 'Ocena',          type: 'categorical' },
  entityType:  { id: 'entityType',  label: 'Vrsta entiteta', type: 'categorical' },
  time:        { id: 'time',        label: 'Vreme',          type: 'time'        },
  gender:      { id: 'gender',      label: 'Pol',            type: 'categorical' },
  ageGroup:    { id: 'ageGroup',    label: 'Starosna gr.',   type: 'categorical' },
};

export const METRIC_CONFIGS: Record<ReportMetricId, ReportMetric> = {
  count:     { id: 'count',     label: 'Broj'           },
  traffic:   { id: 'traffic',   label: 'Posete'         },
  avgRating: { id: 'avgRating', label: 'Prosecna ocena' },
};

export const ENTITY_CONFIGS: EntityConfig[] = [
  { id: 'destinations', label: 'Destinacije', dimensions: ['region', 'time'],                            metrics: ['count', 'traffic', 'avgRating'] },
  { id: 'activities',   label: 'Aktivnosti',  dimensions: ['category', 'destination', 'region', 'time'], metrics: ['count', 'traffic', 'avgRating'] },
  { id: 'events',       label: 'Dogadjaji',   dimensions: ['type', 'destination', 'region', 'time'],     metrics: ['count', 'traffic', 'avgRating'] },
  { id: 'places',       label: 'Objekti',     dimensions: ['type', 'destination', 'region', 'time'],     metrics: ['count', 'traffic', 'avgRating'] },
  { id: 'reviews',      label: 'Recenzije',   dimensions: ['rating', 'entityType', 'time'],              metrics: ['count']                         },
  { id: 'users',        label: 'Korisnici',   dimensions: ['time', 'gender', 'ageGroup'],                metrics: ['count']                         },
];

export const VIZ_BY_DIM: Record<DimensionType, VizType[]> = {
  categorical: ['bar', 'pie', 'table'],
  time:        ['line', 'bar', 'table'],
};

export const VIZ_ICONS: Record<VizType, string> = {
  bar:   'bar_chart',
  line:  'show_chart',
  pie:   'pie_chart',
  table: 'table_chart',
};

export const VIZ_LABELS: Record<VizType, string> = {
  bar:   'Bar',
  line:  'Line',
  pie:   'Pie',
  table: 'Tabela',
};

export const DEST_SORT_OPTIONS: { id: DestTableSortBy; label: string }[] = [
  { id: 'name',       label: 'Naziv'         },
  { id: 'region',     label: 'Regija'        },
  { id: 'type',       label: 'Tip'           },
  { id: 'rating',     label: 'Ocena'         },
  { id: 'popularity', label: 'Popularnost'   },
];

export interface EntityTableRow {
  name:       string;
  subType:    string | null;
  location:   string | null;
  region:     string | null;
  avgRating:  number;
  popularity: number;
}

export const FLAT_TABLE_ENTITIES: { id: FlatTableEntity; label: string }[] = [
  { id: 'destinations', label: 'Destinacije' },
  { id: 'activities',   label: 'Aktivnosti'  },
  { id: 'events',       label: 'Dogadjaji'   },
  { id: 'places',       label: 'Objekti'     },
];

export const FLAT_TABLE_COLS: Record<FlatTableEntity, { header: string; key: string }[]> = {
  destinations: [
    { header: 'Naziv',      key: 'name'       },
    { header: 'Grad',       key: 'location'   },
    { header: 'Regija',     key: 'region'     },
    { header: 'Tip',        key: 'subType'    },
    { header: 'Ocena',      key: 'avgRating'  },
    { header: 'Posete',     key: 'popularity' },
  ],
  activities: [
    { header: 'Naziv',        key: 'name'       },
    { header: 'Kategorija',   key: 'subType'    },
    { header: 'Destinacija',  key: 'location'   },
    { header: 'Regija',       key: 'region'     },
    { header: 'Ocena',        key: 'avgRating'  },
    { header: 'Posete',       key: 'popularity' },
  ],
  events: [
    { header: 'Naziv',        key: 'name'       },
    { header: 'Tip',          key: 'subType'    },
    { header: 'Destinacija',  key: 'location'   },
    { header: 'Regija',       key: 'region'     },
    { header: 'Ocena',        key: 'avgRating'  },
    { header: 'Posete',       key: 'popularity' },
  ],
  places: [
    { header: 'Naziv',        key: 'name'       },
    { header: 'Tip',          key: 'subType'    },
    { header: 'Destinacija',  key: 'location'   },
    { header: 'Regija',       key: 'region'     },
    { header: 'Ocena',        key: 'avgRating'  },
    { header: 'Posete',       key: 'popularity' },
  ],
};

export const FLAT_TABLE_SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'name',       label: 'Naziv'      },
  { id: 'subType',    label: 'Tip/Kat.'   },
  { id: 'location',   label: 'Lokacija'   },
  { id: 'region',     label: 'Regija'     },
  { id: 'rating',     label: 'Ocena'      },
  { id: 'popularity', label: 'Popularnost'},
];

export interface AggregatePoint {
  label: string;
  value: number;
}

export interface ReportInsights {
  topRegion:         string | null;
  newUsersThisMonth: number;
  topEntityType:     string | null;
  countryName:       string | null;
  scopeRegion:       string | null;
}

export interface DestinationsTableItem {
  name:       string;
  city:       string | null;
  region:     string | null;
  type:       string | null;
  avgRating:  number;
  popularity: number;
}

export interface ReportQueueItem {
  id:           string;
  title:        string;
  qtype:        QueueItemType;
  imageUrl?:    string;
  data?:        AggregatePoint[];
  colLabel?:    string;
  colValue?:    string;
  destData?:    DestinationsTableItem[];
  entityData?:  EntityTableRow[];
  entityCols?:  { header: string; key: string }[];
}

export interface EntitySearchItem {
  id:   string;
  name: string;
}

export interface EntityProfile {
  name:          string;
  totalViews:    number;
  avgRating:     number;
  reviewCount:   number;
  placeCount:    number;
  activityCount: number;
  eventCount:    number;
  viewsLast30:   number;
  viewsPrev30:   number;
}

export const SEARCHABLE_ENTITIES: ReportEntity[] = ['destinations', 'activities', 'events', 'places'];

export interface ReportTemplateDto {
  id:         string;
  name:       string;
  parameters: string;
  createdAt:  string;
}

export interface CreateReportTemplateDto {
  name:       string;
  parameters: string;
}

export interface SavedReportConfig {
  entity:    ReportEntity;
  dimension: ReportDimensionId;
  metric:    ReportMetricId;
  vizType:   VizType;
  dateFrom:  string | null;
  dateTo:    string | null;
}

export interface SubtypeOption {
  id:   number;
  name: string;
}

export interface FilterOption {
  optionValue: string;
  optionLabel: string;
}

export interface FilterDefinition {
  id:          number;
  filterKey:   string;
  filterLabel: string;
  filterType:  'boolean' | 'range_int' | 'range_decimal' | 'select' | 'multi_select';
  sortOrder:   number;
  options:     FilterOption[];
}

export const METRIC_COLORS: Record<ReportMetricId, string> = {
  count:     '#d9b26f',
  traffic:   '#28694c',
  avgRating: '#60a5fa',
};

export const PIE_COLORS = [
  '#d9b26f', '#28694c', '#60a5fa', '#a78bfa', '#34d399',
  '#f87171', '#fb923c', '#facc15', '#e879f9', '#38bdf8',
];

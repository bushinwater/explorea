export type DataSource = 'destinations' | 'users' | 'reviews' | 'requests';
export type VizType    = 'bar' | 'line' | 'pie' | 'table';
export type TimeFrame  = 'last30' | 'last3months' | 'last6months' | 'ytd' | 'last12months';

export interface ReportMetric {
  id:       string;
  labelKey: string;
  color:    string;
}

export interface SavedTemplate {
  id:         string;
  name:       string;
  dataSource: DataSource;
  metrics:    string[];
  vizType:    VizType;
  timeFrame:  TimeFrame;
}

export interface PerformanceInsight {
  labelKey: string;
  value:    string;
  trend:    string;
  hintKey:  string;
  tone:     'neutral' | 'success' | 'danger';
}

export const METRIC_FACTORS: Record<string, number> = {
  traffic:    1.0,
  conversion: 0.018,
  users:      0.12,
  growth:     0.075,
};

export const MOCK_BASE: Record<DataSource, Record<TimeFrame, number[]>> = {
  destinations: {
    last30:       [2100, 3400, 2800, 4200, 3700, 5100, 4600],
    last3months:  [18000, 22000, 31000],
    last6months:  [12000, 15000, 18000, 22000, 28000, 31000],
    ytd:          [12000, 15000, 18000, 22000, 28000, 31000, 35000],
    last12months: [8000, 9500, 11000, 12000, 10000, 14000, 18000, 12000, 15000, 18000, 22000, 28000],
  },
  users: {
    last30:       [180, 210, 195, 230, 270, 310, 290],
    last3months:  [1800, 2200, 2800],
    last6months:  [1200, 1500, 1800, 2200, 2800, 3100],
    ytd:          [1200, 1500, 1800, 2200, 2800, 3100, 3500],
    last12months: [800, 950, 1100, 1200, 1000, 1400, 1800, 1200, 1500, 1800, 2200, 2800],
  },
  reviews: {
    last30:       [42, 55, 48, 67, 72, 81, 76],
    last3months:  [380, 450, 620],
    last6months:  [220, 280, 380, 450, 520, 620],
    ytd:          [220, 280, 380, 450, 520, 620, 710],
    last12months: [150, 180, 220, 250, 200, 280, 350, 280, 380, 450, 520, 620],
  },
  requests: {
    last30:       [8, 12, 9, 15, 11, 18, 14],
    last3months:  [52, 68, 91],
    last6months:  [30, 42, 52, 68, 84, 91],
    ytd:          [30, 42, 52, 68, 84, 91, 105],
    last12months: [20, 25, 30, 35, 28, 40, 48, 42, 52, 68, 84, 91],
  },
};

export const TIME_FRAME_LABELS: Record<TimeFrame, string[]> = {
  last30:       ['1.', '5.', '10.', '15.', '20.', '25.', '30.'],
  last3months:  ['Jan', 'Feb', 'Mar'],
  last6months:  ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun'],
  ytd:          ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul'],
  last12months: ['Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'Maj'],
};

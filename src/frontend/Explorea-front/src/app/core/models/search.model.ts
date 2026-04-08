export interface SearchItem {
  entityType: 'destination' | 'place' | 'event' | 'activity';
  entity: {
    id: string;
    name: string;
    slug: string;
    previewImageUrl?: string;
  };
}

export interface SearchResult {
  total: number;
  results: SearchItem[];
}

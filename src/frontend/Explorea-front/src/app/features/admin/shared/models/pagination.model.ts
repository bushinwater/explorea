export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PaginationState extends PageQuery {
  total: number;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
}

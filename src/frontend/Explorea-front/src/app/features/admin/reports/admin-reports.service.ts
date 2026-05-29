import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminGlobalSearchResult, AggregatePoint, CreateReportTemplateDto, DestinationsTableItem, EntityProfile,
  EntitySearchItem, EntityTableRow, FilterDefinition, ReportInsights, ReportTemplateDto, SubtypeOption,
} from './admin-reports.models';

@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  private readonly base = '/api/admin/reports';

  constructor(private readonly http: HttpClient) {}

  globalSearch(q: string): Observable<AdminGlobalSearchResult[]> {
    return this.http.get<AdminGlobalSearchResult[]>(`${this.base}/global-search`, {
      params: new HttpParams().set('q', q),
    });
  }

  getInsights(): Observable<ReportInsights> {
    return this.http.get<ReportInsights>(`${this.base}/insights`);
  }

  getAggregate(
    entity: string, groupBy: string, metric: string,
    dateFrom: string | null, dateTo: string | null,
    specificEntityId?: string | null,
    filterStatus?: string | null,
  ): Observable<AggregatePoint[]> {
    let params = new HttpParams()
      .set('entity',  entity)
      .set('groupBy', groupBy)
      .set('metric',  metric);
    if (dateFrom)          params = params.set('dateFrom',         dateFrom);
    if (dateTo)            params = params.set('dateTo',           dateTo);
    if (specificEntityId)  params = params.set('specificEntityId', specificEntityId);
    if (filterStatus)      params = params.set('filterStatus',     filterStatus);
    return this.http.get<AggregatePoint[]>(`${this.base}/aggregate`, { params });
  }

  searchEntities(entity: string, q: string): Observable<EntitySearchItem[]> {
    const params = new HttpParams().set('entity', entity).set('q', q);
    return this.http.get<EntitySearchItem[]>(`${this.base}/entity-search`, { params });
  }

  getEntityProfile(entity: string, id: string): Observable<EntityProfile> {
    const params = new HttpParams().set('entity', entity).set('id', id);
    return this.http.get<EntityProfile>(`${this.base}/entity-profile`, { params });
  }

  getDestinationsTable(
    sortBy: string,
    filterSubType?: string | null,
    filterRegion?: string | null,
    filterMinRating?: string | null,
    filterStatus?: string | null,
  ): Observable<DestinationsTableItem[]> {
    let params = new HttpParams().set('sortBy', sortBy);
    if (filterSubType)   params = params.set('filterSubType',   filterSubType);
    if (filterRegion)    params = params.set('filterRegion',    filterRegion);
    if (filterMinRating) params = params.set('filterMinRating', filterMinRating);
    if (filterStatus)    params = params.set('filterStatus',    filterStatus);
    return this.http.get<DestinationsTableItem[]>(`${this.base}/destinations-table`, { params });
  }

  getEntityTable(
    entity: string,
    sortBy: string,
    filterSubType?:        string | null,
    filterRegion?:         string | null,
    filterMinRating?:      string | null,
    filterDifficulty?:     string | null,
    filterMinPrice?:       number | null,
    filterMaxPrice?:       number | null,
    filterExtraFilters?:   string[] | null,
    filterDestinationId?:  string | null,
    filterStatus?:         string | null,
  ): Observable<EntityTableRow[]> {
    let params = new HttpParams().set('entity', entity).set('sortBy', sortBy);
    if (filterSubType)         params = params.set('filterSubType',        filterSubType);
    if (filterRegion)          params = params.set('filterRegion',         filterRegion);
    if (filterMinRating)       params = params.set('filterMinRating',      filterMinRating);
    if (filterDifficulty)      params = params.set('filterDifficulty',     filterDifficulty);
    if (filterMinPrice != null) params = params.set('filterMinPrice',      String(filterMinPrice));
    if (filterMaxPrice != null) params = params.set('filterMaxPrice',      String(filterMaxPrice));
    if (filterDestinationId)   params = params.set('filterDestinationId',  filterDestinationId);
    if (filterStatus)          params = params.set('filterStatus',         filterStatus);
    if (filterExtraFilters?.length) {
      filterExtraFilters.forEach(f => { params = params.append('filterExtraFilters', f); });
    }
    return this.http.get<EntityTableRow[]>(`${this.base}/entity-table`, { params });
  }

  getFilterOptions(entity: string, field: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.base}/filter-options`,
      { params: new HttpParams().set('entity', entity).set('field', field) },
    );
  }

  getSubtypeOptions(entity: string): Observable<SubtypeOption[]> {
    return this.http.get<SubtypeOption[]>(
      `${this.base}/subtype-options`,
      { params: new HttpParams().set('entity', entity) },
    );
  }

  getFilterDefinitions(entityType: string, typeId: number): Observable<FilterDefinition[]> {
    return this.http.get<FilterDefinition[]>('/api/filter-definitions', {
      params: new HttpParams().set('entityType', entityType).set('typeId', String(typeId)),
    });
  }

  getTemplates(): Observable<ReportTemplateDto[]> {
    return this.http.get<ReportTemplateDto[]>(`${this.base}/templates`);
  }

  createTemplate(dto: CreateReportTemplateDto): Observable<ReportTemplateDto> {
    return this.http.post<ReportTemplateDto>(`${this.base}/templates`, dto);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }
}

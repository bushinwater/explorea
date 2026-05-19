import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AggregatePoint, CreateReportTemplateDto, DestinationsTableItem,
  EntityTableRow, ReportInsights, ReportTemplateDto,
} from './admin-reports.models';

@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  private readonly base = '/api/admin/reports';

  constructor(private readonly http: HttpClient) {}

  getInsights(): Observable<ReportInsights> {
    return this.http.get<ReportInsights>(`${this.base}/insights`);
  }

  getAggregate(
    entity: string, groupBy: string, metric: string,
    dateFrom: string | null, dateTo: string | null,
  ): Observable<AggregatePoint[]> {
    let params = new HttpParams()
      .set('entity',  entity)
      .set('groupBy', groupBy)
      .set('metric',  metric);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo)   params = params.set('dateTo',   dateTo);
    return this.http.get<AggregatePoint[]>(`${this.base}/aggregate`, { params });
  }

  getDestinationsTable(
    sortBy: string,
    filterSubType?: string | null,
    filterRegion?: string | null,
    filterMinRating?: string | null,
  ): Observable<DestinationsTableItem[]> {
    let params = new HttpParams().set('sortBy', sortBy);
    if (filterSubType)   params = params.set('filterSubType',   filterSubType);
    if (filterRegion)    params = params.set('filterRegion',    filterRegion);
    if (filterMinRating) params = params.set('filterMinRating', filterMinRating);
    return this.http.get<DestinationsTableItem[]>(`${this.base}/destinations-table`, { params });
  }

  getEntityTable(
    entity: string,
    sortBy: string,
    filterSubType?:   string | null,
    filterRegion?:    string | null,
    filterMinRating?: string | null,
    filterPriceRange?: string | null,
    filterAmenity?:   string | null,
    filterDifficulty?: string | null,
    filterPriceCat?:  string | null,
  ): Observable<EntityTableRow[]> {
    let params = new HttpParams().set('entity', entity).set('sortBy', sortBy);
    if (filterSubType)    params = params.set('filterSubType',    filterSubType);
    if (filterRegion)     params = params.set('filterRegion',     filterRegion);
    if (filterMinRating)  params = params.set('filterMinRating',  filterMinRating);
    if (filterPriceRange) params = params.set('filterPriceRange', filterPriceRange);
    if (filterAmenity)    params = params.set('filterAmenity',    filterAmenity);
    if (filterDifficulty) params = params.set('filterDifficulty', filterDifficulty);
    if (filterPriceCat)   params = params.set('filterPriceCat',   filterPriceCat);
    return this.http.get<EntityTableRow[]>(`${this.base}/entity-table`, { params });
  }

  getFilterOptions(entity: string, field: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.base}/filter-options`,
      { params: new HttpParams().set('entity', entity).set('field', field) },
    );
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

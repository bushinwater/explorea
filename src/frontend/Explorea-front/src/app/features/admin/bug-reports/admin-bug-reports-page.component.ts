import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AdminUiPreferencesService } from '../core/services/admin-ui-preferences.service';

interface BugReportItem {
  id: string;
  email: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  userId: string | null;
}

@Component({
  selector: 'app-admin-bug-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-bug-reports-page.component.html',
  styleUrl: './admin-bug-reports-page.component.css',
})
export class AdminBugReportsPageComponent implements OnInit {
  items = signal<BugReportItem[]>([]);
  total = signal(0);
  page = signal(1);
  isLoading = signal(true);
  error = signal<string | null>(null);
  statusFilter = signal<string>('all');
  expandedId = signal<string | null>(null);
  updatingId = signal<string | null>(null);

  readonly pageSize = 20;
  readonly statusOptions = ['all', 'open', 'in_progress', 'resolved', 'closed'];

  constructor(
    private http: HttpClient,
    public ui: AdminUiPreferencesService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load(1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  load(p: number): void {
    this.page.set(p);
    this.isLoading.set(true);
    this.cdr.markForCheck();

    const status = this.statusFilter() !== 'all' ? `&status=${this.statusFilter()}` : '';
    this.http.get<{ total: number; items: BugReportItem[] }>(
      `/api/admin/bug-reports?page=${p}&pageSize=${this.pageSize}${status}`,
    ).subscribe({
      next: res => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error.set('Greška pri učitavanju prijavljenih bugova.');
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.load(1);
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
    this.cdr.markForCheck();
  }

  setStatus(item: BugReportItem, status: string): void {
    if (item.status === status || this.updatingId() === item.id) return;
    this.updatingId.set(item.id);
    this.cdr.markForCheck();

    this.http.patch(`/api/admin/bug-reports/${item.id}/status`, { status }).subscribe({
      next: () => {
        this.items.update(list => list.map(r => r.id === item.id ? { ...r, status: status as any } : r));
        this.updatingId.set(null);
        this.cdr.markForCheck();
      },
      error: () => {
        this.updatingId.set(null);
        this.cdr.markForCheck();
      },
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      open: 'Otvoreno',
      in_progress: 'U radu',
      resolved: 'Rešeno',
      closed: 'Zatvoreno',
    };
    return map[status] ?? status;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('sr-Latn-RS', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}

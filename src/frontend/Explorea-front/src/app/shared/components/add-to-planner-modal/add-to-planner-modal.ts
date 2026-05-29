import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PlannerService } from '../../../core/services/planner.service';

@Component({
  selector: 'app-add-to-planner-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-to-planner-modal.html',
  styleUrl: './add-to-planner-modal.css',
})
export class AddToPlannerModal implements OnInit, OnDestroy {
  @Input() entityType    = '';
  @Input() entityId      = '';
  @Input() entityName    = '';
  @Input() startDatetime = '';
  @Input() endDatetime   = '';
  @Output() closed = new EventEmitter<void>();

  days: { value: string; label: string }[] = [];
  selectedDays: string[] = [];
  dateFrom = '';
  dateTo   = '';
  note     = '';
  saving   = false;
  success  = false;
  error    = '';

  readonly DAY_LABELS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
  calViewDate = new Date();
  calGrid: { date: Date; isCurrentMonth: boolean }[] = [];

  private lockedScrollY = 0;

  constructor(
    private plannerService: PlannerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.lockScroll();
    this.initState();
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  private initState(): void {
    const toStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const days: { value: string; label: string }[] = [];

    if (this.entityType === 'event' && this.startDatetime) {
      const s = new Date(this.startDatetime);
      const e = this.endDatetime ? new Date(this.endDatetime) : s;
      if (!isNaN(s.getTime())) {
        const end = !isNaN(e.getTime()) ? e : s;
        const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        while (cur <= last) {
          days.push({
            value: toStr(cur),
            label: cur.toLocaleDateString('sr-Latn-RS', { weekday: 'short', day: 'numeric', month: 'short' }),
          });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    this.days = days;
    if (this.entityType === 'event') {
      this.selectedDays = days.length > 0 ? [days[0].value] : [];
    } else {
      this.selectedDays = [];
      this.dateFrom = '';
      this.dateTo   = '';
      this.calViewDate = new Date();
      this.buildCalGrid();
    }
  }

  // ─── Calendar ──────────────────────────────────────────────────────

  get calMonthLabel(): string {
    return this.calViewDate.toLocaleDateString('sr-Latn-RS', { month: 'long', year: 'numeric' });
  }

  buildCalGrid(): void {
    const year = this.calViewDate.getFullYear();
    const month = this.calViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const lastDay = new Date(year, month + 1, 0);
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let d = startOffset - 1; d >= 0; d--)
      cells.push({ date: new Date(year, month, -d), isCurrentMonth: false });
    for (let d = 1; d <= lastDay.getDate(); d++)
      cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
    while (cells.length < 42) {
      const n = cells.length - startOffset - lastDay.getDate() + 1;
      cells.push({ date: new Date(year, month + 1, n), isCurrentMonth: false });
    }
    this.calGrid = cells;
  }

  prevMonth(): void {
    this.calViewDate = new Date(this.calViewDate.getFullYear(), this.calViewDate.getMonth() - 1, 1);
    this.buildCalGrid();
    this.cdr.detectChanges();
  }

  nextMonth(): void {
    this.calViewDate = new Date(this.calViewDate.getFullYear(), this.calViewDate.getMonth() + 1, 1);
    this.buildCalGrid();
    this.cdr.detectChanges();
  }

  selectDate(cell: { date: Date; isCurrentMonth: boolean }): void {
    if (!cell.isCurrentMonth) return;
    const str = this.dateToStr(cell.date);
    if (!this.dateFrom || this.dateTo) {
      this.dateFrom = str;
      this.dateTo   = '';
    } else if (str >= this.dateFrom) {
      this.dateTo = str;
    } else {
      this.dateFrom = str;
      this.dateTo   = '';
    }
    this.cdr.detectChanges();
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
  }

  isRangeStart(date: Date): boolean { return !!this.dateFrom && this.matchesStr(date, this.dateFrom); }
  isRangeEnd(date: Date): boolean   { return !!this.dateTo   && this.matchesStr(date, this.dateTo); }
  isInRange(date: Date): boolean {
    if (!this.dateFrom || !this.dateTo) return false;
    const s = this.dateToStr(date);
    return s > this.dateFrom && s < this.dateTo;
  }

  formatRangeDate(str: string): string {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' });
  }

  trackByCell(_: number, c: { date: Date }): string { return c.date.toISOString(); }

  // ─── Day chips ─────────────────────────────────────────────────────

  toggleDay(value: string): void {
    const idx = this.selectedDays.indexOf(value);
    this.selectedDays = idx >= 0
      ? this.selectedDays.filter(d => d !== value)
      : [...this.selectedDays, value];
  }

  // ─── Submit ────────────────────────────────────────────────────────

  confirm(): void {
    if (this.saving) return;
    if (this.entityType === 'event' && this.selectedDays.length === 0) {
      this.error = 'Izaberi barem jedan dan.';
      this.cdr.detectChanges();
      return;
    }
    if (this.entityType !== 'event' && !this.dateFrom) {
      this.error = 'Izaberi datum.';
      this.cdr.detectChanges();
      return;
    }
    this.saving = true;
    this.error  = '';
    this.cdr.detectChanges();

    const obs = this.entityType === 'event'
      ? forkJoin(this.selectedDays.map(d => this.plannerService.addEntry(this.entityId, d, this.note)))
      : forkJoin(
          this.buildDateRange(this.dateFrom, this.dateTo || this.dateFrom)
            .map(d => this.plannerService.addGenericEntry(this.entityType, this.entityId, d, this.note))
        );

    obs.subscribe({
      next: () => {
        this.saving  = false;
        this.success = true;
        this.cdr.detectChanges();
        setTimeout(() => this.close(), 900);
      },
      error: (err: any) => {
        this.saving = false;
        this.error  = err?.error?.message ?? 'Greška pri čuvanju. Pokušaj ponovo.';
        this.cdr.detectChanges();
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private buildDateRange(from: string, to: string): string[] {
    const result: string[] = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (cur <= end) {
      result.push(this.dateToStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  private dateToStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private matchesStr(date: Date, str: string): boolean {
    const [y, m, d] = str.split('-').map(Number);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  private lockScroll(): void {
    if (document.body.style.position === 'fixed') return;
    this.lockedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (document.body.style.position !== 'fixed') return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo({ top: this.lockedScrollY, behavior: 'instant' as ScrollBehavior });
  }
}

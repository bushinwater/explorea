import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BodyStatService } from '../../shared/services/api.service';
import { BodyStat } from '../../shared/models/models';

@Component({
  selector: 'app-body-stats',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-header">
      <h1>Praćenje težine</h1>
    </div>

    <div class="two-col">
      <!-- Add form -->
      <div class="form-card">
        <h3>Dodaj merenje</h3>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label>Težina (kg)</label>
            <input type="number" formControlName="weightKg" placeholder="75.5" step="0.1" min="20" />
          </div>
          <div class="field">
            <label>Beleška (opciono)</label>
            <input type="text" formControlName="notes" placeholder="Jutarnje merenje..." />
          </div>
          <div class="form-success" *ngIf="success">Sačuvano!</div>
          <button type="submit" class="btn-primary" [disabled]="loading()">Sačuvaj</button>
        </form>
      </div>

      <!-- Stats list -->
      <div>
        <div *ngIf="stats().length === 0" class="empty-state">Nema evidentiranih merenja.</div>
        <div class="stat-row" *ngFor="let s of stats()">
          <div>
            <span class="stat-date">{{ s.date | date:'dd.MM.yyyy' }}</span>
            <span class="stat-note" *ngIf="s.notes">— {{ s.notes }}</span>
          </div>
          <div class="stat-weight-row">
            <span class="stat-weight">{{ s.weightKg }} kg</span>
            <button class="btn-danger-sm" (click)="delete(s.id)">✕</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BodyStatsComponent implements OnInit {
  stats = signal<BodyStat[]>([]);
  loading = signal(false);
  success = false;

  form = this.fb.group({
    weightKg: ['', [Validators.required, Validators.min(20)]],
    notes: [''],
  });

  constructor(private fb: FormBuilder, private bodyStatService: BodyStatService) {}

  ngOnInit() {
    this.bodyStatService.getAll().subscribe(s => this.stats.set(s));
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { weightKg, notes } = this.form.value;
    this.bodyStatService.create(Number(weightKg), notes || undefined).subscribe(s => {
      this.stats.update(arr => [s, ...arr]);
      this.form.reset();
      this.loading.set(false);
      this.success = true;
      setTimeout(() => this.success = false, 2000);
    });
  }

  delete(id: number) {
    this.bodyStatService.delete(id).subscribe(() =>
      this.stats.update(arr => arr.filter(s => s.id !== id))
    );
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BodyStatService } from '../../shared/services/api.service';
import { BodyStat } from '../../shared/models/models';

@Component({
  selector: 'app-body-stats',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './body-stats.component.html',
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
